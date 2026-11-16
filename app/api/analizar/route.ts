import { NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, MODELO } from '@/lib/anthropic';
import { getUsuario } from '@/lib/supabase/server';
import { fichaPaciente, imagenComoBloque } from '@/lib/caso-servidor';
import { HERRAMIENTA_ANALISIS, PROMPT_ANALISIS } from '@/lib/prompts';
import { AnalisisSchema, type Paciente } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Analiza las imágenes iniciales del caso con Claude y guarda el resultado estructurado. */
export async function POST(req: Request) {
  const { supabase, user } = await getUsuario();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = z.object({ casoId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Petición inválida' }, { status: 400 });
  const { casoId } = body.data;

  // RLS garantiza que solo se obtiene si el caso es del veterinario
  const { data: caso } = await supabase
    .from('casos')
    .select('*, pacientes(*), imagenes(ruta, tipo)')
    .eq('id', casoId)
    .single();
  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });

  const paciente = caso.pacientes as Paciente;
  const rutas = (caso.imagenes as { ruta: string; tipo: string }[])
    .filter((i) => i.tipo === 'inicial')
    .map((i) => i.ruta);

  try {
    const bloquesImagen = await Promise.all(rutas.map((r) => imagenComoBloque(supabase, r)));

    const respuesta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system: PROMPT_ANALISIS,
      tools: [HERRAMIENTA_ANALISIS as Anthropic.Tool],
      tool_choice: { type: 'tool', name: HERRAMIENTA_ANALISIS.name },
      messages: [
        {
          role: 'user',
          content: [
            ...bloquesImagen,
            {
              type: 'text',
              text: `Analiza ${rutas.length > 1 ? `estas ${rutas.length} imágenes` : 'esta imagen'} del paciente.\n\n${fichaPaciente(paciente, caso)}`,
            },
          ],
        },
      ],
    });

    const bloqueTool = respuesta.content.find((b) => b.type === 'tool_use');
    if (!bloqueTool || bloqueTool.type !== 'tool_use') throw new Error('La IA no devolvió un análisis estructurado');

    const analisis = AnalisisSchema.parse(bloqueTool.input);

    await supabase
      .from('casos')
      .update({
        analisis,
        estado: 'analizado',
        diagnostico_ia: analisis.imagen_valida ? (analisis.diagnostico_principal?.nombre ?? null) : null,
        urgencia: analisis.imagen_valida ? analisis.urgencia : null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', casoId);

    return NextResponse.json({ analisis });
  } catch (err) {
    console.error('[analizar]', err);
    await supabase.from('casos').update({ estado: 'error' }).eq('id', casoId);

    let mensaje = 'No se pudo completar el análisis. Inténtalo de nuevo.';
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) mensaje = 'El servicio de IA está saturado. Espera un momento y reintenta.';
      else if (err.status === 401) mensaje = 'La clave de la API de IA no es válida (revisa ANTHROPIC_API_KEY).';
      else if (err.status && err.status >= 500) mensaje = 'El servicio de IA no está disponible ahora mismo.';
    }
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
