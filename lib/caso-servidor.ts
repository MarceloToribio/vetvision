import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET } from './constantes';
import type { Caso, ImagenFirmada, Paciente } from './types';

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** Descarga una imagen del bucket y la convierte en un bloque de imagen para Claude. */
export async function imagenComoBloque(
  supabase: SupabaseClient,
  ruta: string,
): Promise<Anthropic.ImageBlockParam> {
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
  if (error || !data) throw new Error(`No se pudo leer la imagen ${ruta}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  const tipo = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.type)
    ? data.type
    : 'image/jpeg') as MediaType;
  return {
    type: 'image',
    source: { type: 'base64', media_type: tipo, data: buffer.toString('base64') },
  };
}

/** Genera URLs firmadas (1 hora) para mostrar imágenes privadas en el navegador. */
export async function firmarImagenes(
  supabase: SupabaseClient,
  imagenes: { ruta: string; tipo: 'inicial' | 'seguimiento' }[],
): Promise<ImagenFirmada[]> {
  if (imagenes.length === 0) return [];
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      imagenes.map((i) => i.ruta),
      3600,
    );
  return imagenes
    .map((img, i) => ({ ...img, url: data?.[i]?.signedUrl ?? '' }))
    .filter((i) => i.url);
}

/** Comprueba que una ruta pertenece al veterinario y al caso (defensa adicional a RLS). */
export function rutaValida(ruta: string, userId: string, casoId: string) {
  return ruta.startsWith(`${userId}/${casoId}/`) && !ruta.includes('..');
}

/** Ficha del paciente en texto, usada por el análisis y por el chat. */
export function fichaPaciente(paciente: Paciente, caso: Pick<Caso, 'zona_afectada' | 'sintomas' | 'tiempo_evolucion'>) {
  return [
    `Especie: ${paciente.especie}`,
    `Raza: ${paciente.raza || 'no indicada'}`,
    `Edad: ${paciente.edad_anios != null ? `${paciente.edad_anios} años` : 'no indicada'}`,
    `Peso: ${paciente.peso_kg != null ? `${paciente.peso_kg} kg` : 'no indicado'}`,
    `Sexo: ${paciente.sexo || 'no indicado'}`,
    `Zona afectada: ${caso.zona_afectada}`,
    `Síntomas observados: ${caso.sintomas || 'no indicados'}`,
    `Tiempo de evolución: ${caso.tiempo_evolucion || 'no indicado'}`,
  ].join('\n');
}

/** Contexto completo del caso para el chat clínico. */
export function contextoCaso(paciente: Paciente, caso: Caso) {
  const partes = [`## Datos del paciente y del caso\n${fichaPaciente(paciente, caso)}`];

  if (caso.analisis) {
    partes.push(`## Análisis automático previo (IA)\n${JSON.stringify(caso.analisis, null, 2)}`);
  }
  if (caso.diagnostico_final || caso.tratamiento_final || caso.notas_veterinario) {
    partes.push(
      [
        '## Revisión del veterinario (tiene prioridad sobre el análisis automático)',
        `Diagnóstico final: ${caso.diagnostico_final || '—'}`,
        `Tratamiento indicado: ${caso.tratamiento_final || '—'}`,
        `Notas: ${caso.notas_veterinario || '—'}`,
      ].join('\n'),
    );
  }
  return partes.join('\n\n');
}
