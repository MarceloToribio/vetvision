import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, iaConfigurada, MODELO } from '@/lib/anthropic';
import { getUsuario } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnóstico de la conexión con la IA: GET /api/salud
 * Hace una llamada mínima a Claude y devuelve si funciona. No expone la clave.
 */
export async function GET() {
  // Solo para usuarios con sesión: evita que cualquiera genere llamadas a la IA
  const { user } = await getUsuario();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para usar este diagnóstico' }, { status: 401 });

  const base = { modelo: MODELO, clave_configurada: iaConfigurada() };
  if (!base.clave_configurada) {
    return NextResponse.json({ ...base, ia_ok: false, detalle: 'Falta ANTHROPIC_API_KEY' }, { status: 503 });
  }
  try {
    const r = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Responde solo: ok' }],
    });
    return NextResponse.json({ ...base, ia_ok: true, respuesta: r.content.map((b) => (b.type === 'text' ? b.text : '')).join('') });
  } catch (err) {
    const detalle =
      err instanceof Anthropic.APIError ? `Error ${err.status}: ${err.message}` : err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ ...base, ia_ok: false, detalle }, { status: 502 });
  }
}
