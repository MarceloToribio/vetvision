import { z } from 'zod';

export type Especie = 'perro' | 'gato';
export type Urgencia = 'rutina' | 'pronto' | 'urgente';
export type EstadoCaso = 'pendiente' | 'analizado' | 'revisado' | 'error';

/** Esquema del análisis de la IA (validación en el servidor). */
export const AnalisisSchema = z.object({
  imagen_valida: z.boolean(),
  motivo_si_invalida: z.string().default(''),
  hallazgos_visuales: z.array(z.string()).default([]),
  diagnostico_principal: z
    .object({
      nombre: z.string(),
      confianza: z.enum(['alta', 'media', 'baja']),
      justificacion: z.string(),
    })
    .nullable()
    .default(null),
  diferenciales: z.array(z.object({ nombre: z.string(), justificacion: z.string() })).default([]),
  pruebas_recomendadas: z.array(z.string()).default([]),
  tratamiento: z
    .object({
      general: z.string().default(''),
      farmacologico: z.array(z.string()).default([]),
      cuidados_casa: z.array(z.string()).default([]),
      senales_alarma: z.array(z.string()).default([]),
    })
    .default({ general: '', farmacologico: [], cuidados_casa: [], senales_alarma: [] }),
  urgencia: z.enum(['rutina', 'pronto', 'urgente']).nullable().default(null),
});

export type Analisis = z.infer<typeof AnalisisSchema>;

export interface Paciente {
  id: string;
  nombre: string | null;
  especie: Especie;
  raza: string | null;
  edad_anios: number | null;
  peso_kg: number | null;
  sexo: 'macho' | 'hembra' | null;
}

export interface Caso {
  id: string;
  paciente_id: string;
  zona_afectada: string;
  sintomas: string | null;
  tiempo_evolucion: string | null;
  estado: EstadoCaso;
  analisis: Analisis | null;
  diagnostico_ia: string | null;
  urgencia: Urgencia | null;
  diagnostico_final: string | null;
  tratamiento_final: string | null;
  notas_veterinario: string | null;
  creado_en: string;
}

export interface Mensaje {
  id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  imagenes: string[];
  creado_en: string;
}

/** Imagen con URL firmada temporal para mostrarla en el navegador. */
export interface ImagenFirmada {
  ruta: string;
  url: string;
  tipo: 'inicial' | 'seguimiento';
}
