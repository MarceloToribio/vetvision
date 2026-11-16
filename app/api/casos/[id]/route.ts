import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUsuario } from '@/lib/supabase/server';

const Revision = z.object({
  diagnostico_final: z.string().max(300),
  tratamiento_final: z.string().max(5000),
  notas_veterinario: z.string().max(5000),
});

/** Guarda la revisión del veterinario (confirmar / corregir diagnóstico y tratamiento). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUsuario();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const parsed = Revision.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { data, error } = await supabase
    .from('casos')
    .update({
      diagnostico_final: parsed.data.diagnostico_final.trim() || null,
      tratamiento_final: parsed.data.tratamiento_final.trim() || null,
      notas_veterinario: parsed.data.notas_veterinario.trim() || null,
      estado: 'revisado',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .single();

  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar la revisión' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Elimina un caso (cascada en BD) y sus imágenes del bucket. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUsuario();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: archivos } = await supabase.storage.from('imagenes-casos').list(`${user.id}/${id}`);
  if (archivos?.length) {
    await supabase.storage.from('imagenes-casos').remove(archivos.map((a) => `${user.id}/${id}/${a.name}`));
  }
  const { error } = await supabase.from('casos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
