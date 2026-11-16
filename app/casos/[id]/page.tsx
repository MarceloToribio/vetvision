import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUsuario } from '@/lib/supabase/server';
import { firmarImagenes } from '@/lib/caso-servidor';
import type { Caso, Mensaje, Paciente } from '@/lib/types';
import ResultadoAnalisis from '@/components/ResultadoAnalisis';
import RevisionVeterinario from '@/components/RevisionVeterinario';
import ChatClinico from '@/components/ChatClinico';
import BotonAnalizar from '@/components/BotonAnalizar';
import BotonPDF from '@/components/BotonPDF';

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUsuario();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('casos')
    .select('*, pacientes(*), imagenes(ruta, tipo, creado_en)')
    .eq('id', id)
    .single();
  if (!data) notFound();

  const caso = data as Caso;
  const paciente = data.pacientes as Paciente;
  const imgs = (data.imagenes as { ruta: string; tipo: 'inicial' | 'seguimiento'; creado_en: string }[]).sort((a, b) =>
    a.creado_en.localeCompare(b.creado_en),
  );

  const [{ data: perfil }, { data: conv }] = await Promise.all([
    supabase.from('usuarios').select('nombre, clinica').eq('id', user.id).maybeSingle(),
    supabase
      .from('conversaciones')
      .select('id, mensajes(id, rol, contenido, imagenes, creado_en)')
      .eq('caso_id', id)
      .maybeSingle(),
  ]);

  const mensajes = ((conv?.mensajes ?? []) as Mensaje[]).sort((a, b) => a.creado_en.localeCompare(b.creado_en));

  // URLs firmadas para imágenes del caso y del chat
  const firmadas = await firmarImagenes(supabase, imgs);
  const urlDe = new Map(firmadas.map((f) => [f.ruta, f.url]));
  const iniciales = firmadas.filter((f) => f.tipo === 'inicial');
  const seguimiento = firmadas.filter((f) => f.tipo === 'seguimiento');

  const mensajesUI = mensajes.map((m) => ({
    id: m.id,
    rol: m.rol,
    contenido: m.contenido,
    imagenes: (m.imagenes ?? []).map((r) => urlDe.get(r)).filter((u): u is string => !!u),
  }));

  const fecha = new Date(caso.creado_en).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/casos" className="text-sm text-clinico-700 hover:underline">
            ← Historial
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-clinico-800">
            {paciente.especie === 'perro' ? '🐶' : '🐱'} {paciente.nombre || 'Paciente sin nombre'}
            <span className="ml-2 text-base font-normal text-slate-500">· {caso.zona_afectada}</span>
          </h1>
          <p className="text-sm text-slate-500">
            {[paciente.raza, paciente.edad_anios != null && `${paciente.edad_anios} años`, paciente.peso_kg != null && `${paciente.peso_kg} kg`, paciente.sexo]
              .filter(Boolean)
              .join(' · ')}{' '}
            — {fecha}
          </p>
        </div>
        <BotonPDF
          caso={caso}
          paciente={paciente}
          veterinario={{ nombre: perfil?.nombre ?? null, clinica: perfil?.clinica ?? null }}
          urlsImagenes={iniciales.map((i) => i.url)}
          chat={mensajes.map((m) => ({ rol: m.rol, contenido: m.contenido }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section className="tarjeta">
            <h2 className="mb-3 text-lg font-semibold text-clinico-800">Imágenes</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {iniciales.map((img) => (
                <a key={img.ruta} href={img.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="Imagen clínica" className="h-full w-full object-cover transition hover:scale-105" />
                </a>
              ))}
            </div>
            {seguimiento.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-500">Seguimiento</h3>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {seguimiento.map((img) => (
                    <a key={img.ruta} href={img.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Seguimiento" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </>
            )}
            {caso.sintomas && (
              <p className="mt-4 text-sm text-slate-600">
                <b>Síntomas:</b> {caso.sintomas}
                {caso.tiempo_evolucion && <> · <b>Evolución:</b> {caso.tiempo_evolucion}</>}
              </p>
            )}
          </section>

          {caso.analisis ? (
            <>
              <ResultadoAnalisis analisis={caso.analisis} />
              <div className="flex justify-end">
                <BotonAnalizar casoId={caso.id} etiqueta="Volver a analizar" />
              </div>
            </>
          ) : (
            <div className="tarjeta text-center">
              <p className="mb-4 text-slate-600">
                {caso.estado === 'error'
                  ? 'El análisis anterior falló. Puedes intentarlo de nuevo.'
                  : 'Este caso aún no ha sido analizado.'}
              </p>
              <BotonAnalizar casoId={caso.id} />
            </div>
          )}

          <RevisionVeterinario caso={caso} />
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <ChatClinico
            casoId={caso.id}
            mensajesIniciales={mensajesUI}
            diagnostico={caso.diagnostico_final || caso.diagnostico_ia}
          />
        </div>
      </div>
    </div>
  );
}
