import { NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, iaConfigurada, MENSAJE_SIN_CLAVE, MODELO } from '@/lib/anthropic';
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
  if (!iaConfigurada()) return NextResponse.json({ error: MENSAJE_SIN_CLAVE }, { status: 503 });

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
      // Este modelo no admite forzar la herramienta (tool_choice "tool"/"any"):
      // se usa "auto" y el prompt exige llamarla; si responde en texto, se extrae el JSON.
      tool_choice: { type: 'auto' },
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

    const analisis = AnalisisSchema.parse(extraerAnalisis(respuesta));

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
      else if (err.status === 404) mensaje = `El modelo "${MODELO}" no existe o no está disponible (revisa ANTHROPIC_MODEL).`;
      else if (err.status && err.status >= 500) mensaje = 'El servicio de IA no está disponible ahora mismo.';
    }
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}

/** Obtiene el JSON del análisis: de la llamada a la herramienta o, si no, del texto. */
function extraerAnalisis(respuesta: Anthropic.Message): unknown {
  const tool = respuesta.content.find((b) => b.type === 'tool_use');
  if (tool && tool.type === 'tool_use') return tool.input;

  const texto = respuesta.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio !== -1 && fin > inicio) {
    try {
      return JSON.parse(texto.slice(inicio, fin + 1));
    } catch {
      /* cae al error de abajo */
    }
  }
  throw new Error('La IA no devolvió un análisis estructurado');
}
