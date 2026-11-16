export const BUCKET = 'imagenes-casos';

export const MAX_IMAGENES = 5;
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

export const ZONAS = [
  'Piel / pelaje (tronco)',
  'Cabeza / cara',
  'Ojos',
  'Oídos / pabellón auricular',
  'Boca / encías / dientes',
  'Nariz / trufa',
  'Extremidades',
  'Almohadillas / interdigital',
  'Uñas',
  'Cola / zona perianal',
  'Abdomen / zona inguinal',
  'Mamas',
  'Genitales',
  'Herida / traumatismo',
  'Masa / bulto',
  'Otra',
] as const;

export const URGENCIA_ESTILO: Record<string, { etiqueta: string; clase: string }> = {
  rutina: { etiqueta: 'Rutina', clase: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  pronto: { etiqueta: 'Atender pronto', clase: 'bg-amber-100 text-amber-800 ring-amber-200' },
  urgente: { etiqueta: 'Urgente', clase: 'bg-red-100 text-red-800 ring-red-200' },
};

export const CONFIANZA_ESTILO: Record<string, string> = {
  alta: 'bg-clinico-100 text-clinico-800',
  media: 'bg-sky-100 text-sky-800',
  baja: 'bg-slate-200 text-slate-700',
};

export const AVISO_LEGAL =
  'Resultado orientativo. El diagnóstico y la prescripción final son responsabilidad del médico veterinario.';
