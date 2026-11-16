import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUsuario } from '@/lib/supabase/server';
import { rutaValida } from '@/lib/caso-servidor';
import { MAX_IMAGENES } from '@/lib/constantes';

const numeroOpcional = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), 'Número inválido');

const NuevoCaso = z.object({
  id: z.string().uuid(),
  nombre: z.string().max(80).optional().default(''),
  especie: z.enum(['perro', 'gato']),
  raza: z.string().max(80).optional().default(''),
  edad_anios: numeroOpcional,
  peso_kg: numeroOpcional,
  sexo: z.enum(['macho', 'hembra', '']).optional().default(''),
  zona_afectada: z.string().min(1).max(80),
  sintomas: z.string().max(3000).optional().default(''),
  tiempo_evolucion: z.string().max(120).optional().default(''),
  imagenes: z.array(z.string()).min(1).max(MAX_IMAGENES),
});

/** Crea el paciente, el caso y registra las imágenes ya subidas al bucket. */
export async function POST(req: Request) {
  const { supabase, user } = await getUsuario();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const parsed = NuevoCaso.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos del formulario inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  if (!d.imagenes.every((r) => rutaValida(r, user.id, d.id))) {
    return NextResponse.json({ error: 'Rutas de imagen inválidas' }, { status: 400 });
  }

  const { data: paciente, error: errPaciente } = await supabase
    .from('pacientes')
    .insert({
      veterinario_id: user.id,
      nombre: d.nombre || null,
      especie: d.especie,
      raza: d.raza || null,
      edad_anios: d.edad_anios,
      peso_kg: d.peso_kg,
      sexo: d.sexo || null,
    })
    .select('id')
    .single();
  if (errPaciente) return NextResponse.json({ error: 'No se pudo guardar el paciente' }, { status: 500 });

  const { error: errCaso } = await supabase.from('casos').insert({
    id: d.id,
    veterinario_id: user.id,
    paciente_id: paciente.id,
    zona_afectada: d.zona_afectada,
    sintomas: d.sintomas || null,
    tiempo_evolucion: d.tiempo_evolucion || null,
  });
  if (errCaso) return NextResponse.json({ error: 'No se pudo guardar el caso' }, { status: 500 });

  const { error: errImg } = await supabase.from('imagenes').insert(
    d.imagenes.map((ruta) => ({ caso_id: d.id, veterinario_id: user.id, ruta, tipo: 'inicial' })),
  );
  if (errImg) return NextResponse.json({ error: 'No se pudieron registrar las imágenes' }, { status: 500 });

  return NextResponse.json({ id: d.id }, { status: 201 });
}
