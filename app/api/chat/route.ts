import { NextResponse } from 'next/server';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, MODELO } from '@/lib/anthropic';
import { getUsuario } from '@/lib/supabase/server';
import { contextoCaso, imagenComoBloque, rutaValida } from '@/lib/caso-servidor';
import { PROMPT_CHAT, PROMPT_RESUMEN } from '@/lib/prompts';
import type { Caso, Mensaje, Paciente } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Mensajes recientes que se envían literalmente; los anteriores se resumen. */
const VENTANA = 12;

const Peticion = z.object({
  casoId: z.string().uuid(),
  mensaje: z.string().max(4000).default(''),
  imagenes: z.array(z.string()).max(3).default([]),
});

export async function POST(req: Request) {
  const { supabase, user } = await getUsuario();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const parsed = Peticion.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Petición inválida' }, { status: 400 });
  const { casoId, imagenes } = parsed.data;
  const mensaje = parsed.data.mensaje.trim();
  if (!mensaje && imagenes.length === 0) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
  if (!imagenes.every((r) => rutaValida(r, user.id, casoId))) {
    return NextResponse.json({ error: 'Imagen inválida' }, { status: 400 });
  }

  // --- Caso completo (RLS: solo si pertenece al veterinario) ---
  const { data: caso } = await supabase
    .from('casos')
    .select('*, pacientes(*), imagenes(ruta, tipo, creado_en)')
    .eq('id', casoId)
    .single();
  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });

  // --- Conversación (una por caso) ---
  let { data: conv } = await supabase.from('conversaciones').select('*').eq('caso_id', casoId).maybeSingle();
  if (!conv) {
    const { data: nueva, error } = await supabase
      .from('conversaciones')
      .insert({ caso_id: casoId, veterinario_id: user.id })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: 'No se pudo iniciar la conversación' }, { status: 500 });
    conv = nueva;
  }

  const { data: historialRaw } = await supabase
    .from('mensajes')
    .select('id, rol, contenido, imagenes, creado_en')
    .eq('conversacion_id', conv.id)
    .order('creado_en', { ascending: true });
  const historial = (historialRaw ?? []) as Mensaje[];

  // --- Resumen de mensajes antiguos cuando la conversación crece ---
  let resumen: string | null = conv.resumen;
  let resumidos: number = conv.mensajes_resumidos;
  const corte = Math.max(0, historial.length - VENTANA);
  if (corte - resumidos >= VENTANA) {
    try {
      const pendientes = historial.slice(resumidos, corte);
      const texto =
        (resumen ? `Resumen previo:\n${resumen}\n\nMensajes nuevos:\n` : '') +
        pendientes.map((m) => `${m.rol === 'user' ? 'Veterinario' : 'IA'}: ${m.contenido}`).join('\n\n');
      const r = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 800,
        system: PROMPT_RESUMEN,
        messages: [{ role: 'user', content: texto }],
      });
      resumen = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      resumidos = corte;
      await supabase
        .from('conversaciones')
        .update({ resumen, mensajes_resumidos: resumidos })
        .eq('id', conv.id);
    } catch (e) {
      console.error('[chat] resumen', e); // si falla, se envía más historial literal
    }
  }

  // --- Guardar el mensaje del veterinario y sus imágenes de seguimiento ---
  await supabase.from('mensajes').insert({
    conversacion_id: conv.id,
    veterinario_id: user.id,
    rol: 'user',
    contenido: mensaje || '(imagen de seguimiento)',
    imagenes,
  });
  if (imagenes.length) {
    await supabase
      .from('imagenes')
      .insert(imagenes.map((ruta) => ({ caso_id: casoId, veterinario_id: user.id, ruta, tipo: 'seguimiento' })));
  }

  // --- Construir los mensajes para Claude ---
  let mensajes: Anthropic.MessageParam[];
  try {
    const iniciales = (caso.imagenes as { ruta: string; tipo: string }[])
      .filter((i) => i.tipo === 'inicial')
      .map((i) => i.ruta);
    const bloquesIniciales = await Promise.all(iniciales.map((r) => imagenComoBloque(supabase, r)));
    const bloquesNuevos = await Promise.all(imagenes.map((r) => imagenComoBloque(supabase, r)));

    const contexto: Anthropic.ContentBlockParam[] = [
      ...bloquesIniciales,
      {
        type: 'text',
        text:
          `# CONTEXTO DEL CASO (imágenes iniciales arriba)\n${contextoCaso(caso.pacientes as Paciente, caso as Caso)}` +
          (resumen ? `\n\n## Resumen de la conversación anterior\n${resumen}` : '') +
          '\n\n# FIN DEL CONTEXTO',
        cache_control: { type: 'ephemeral' },
      },
    ];

    const recientes: Anthropic.MessageParam[] = historial.slice(resumidos).map((m) => ({
      role: m.rol,
      content:
        m.contenido +
        (m.imagenes?.length ? `\n[El veterinario adjuntó ${m.imagenes.length} imagen(es) de seguimiento en este mensaje]` : ''),
    }));

    const actual: Anthropic.MessageParam = {
      role: 'user',
      content: [
        ...bloquesNuevos,
        {
          type: 'text',
          text:
            (bloquesNuevos.length ? 'Imagen(es) de seguimiento adjuntas. Compáralas con las iniciales.\n\n' : '') +
            (mensaje || 'Evalúa la evolución en esta imagen de seguimiento.'),
        },
      ],
    };

    mensajes = normalizar(contexto, [...recientes, actual]);
  } catch (e) {
    console.error('[chat] preparar', e);
    return NextResponse.json({ error: 'No se pudieron cargar las imágenes del caso' }, { status: 500 });
  }

  // --- Respuesta en streaming ---
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let completo = '';
      try {
        const respuesta = anthropic.messages.stream({
          model: MODELO,
          max_tokens: 2500,
          system: PROMPT_CHAT,
          messages: mensajes,
        });
        for await (const ev of respuesta) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            completo += ev.delta.text;
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        await supabase.from('mensajes').insert({
          conversacion_id: conv.id,
          veterinario_id: user.id,
          rol: 'assistant',
          contenido: completo,
        });
      } catch (e) {
        console.error('[chat] stream', e);
        controller.enqueue(encoder.encode('\n\n⚠️ Se interrumpió la respuesta de la IA. Vuelve a intentarlo.'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

/**
 * Garantiza el formato que exige la API: empieza por "user", roles alternos,
 * y el contexto del caso al principio del primer mensaje del usuario.
 */
function normalizar(contexto: Anthropic.ContentBlockParam[], lista: Anthropic.MessageParam[]) {
  const aBloques = (c: Anthropic.MessageParam['content']): Anthropic.ContentBlockParam[] =>
    typeof c === 'string' ? [{ type: 'text', text: c }] : c;

  // Fusiona mensajes consecutivos del mismo rol (p. ej., si una respuesta anterior falló)
  const fusion: Anthropic.MessageParam[] = [];
  for (const m of lista) {
    const ultimo = fusion[fusion.length - 1];
    if (ultimo && ultimo.role === m.role) {
      ultimo.content = [...aBloques(ultimo.content), ...aBloques(m.content)];
    } else {
      fusion.push({ role: m.role, content: aBloques(m.content) });
    }
  }

  if (fusion[0]?.role === 'user') {
    fusion[0].content = [...contexto, ...aBloques(fusion[0].content)];
  } else {
    fusion.unshift({ role: 'user', content: contexto });
  }
  return fusion;
}
