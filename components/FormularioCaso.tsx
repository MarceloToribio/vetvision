'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BUCKET, ZONAS } from '@/lib/constantes';
import ImageUploader from './ImageUploader';

type Paso = 'formulario' | 'subiendo' | 'analizando';

export default function FormularioCaso() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('formulario');
  const [error, setError] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [f, setF] = useState({
    nombre: '',
    especie: 'perro',
    raza: '',
    edad_anios: '',
    peso_kg: '',
    sexo: '',
    zona_afectada: ZONAS[0] as string,
    sintomas: '',
    tiempo_evolucion: '',
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (archivos.length === 0) {
      setError('Sube al menos una imagen.');
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const casoId = crypto.randomUUID();

    try {
      // 1) Subida directa al bucket privado: {usuario}/{caso}/{archivo}
      setPaso('subiendo');
      const rutas: string[] = [];
      for (const archivo of archivos) {
        const ruta = `${user.id}/${casoId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
          contentType: archivo.type,
          upsert: false,
        });
        if (error) throw new Error('No se pudieron subir las imágenes. Revisa tu conexión.');
        rutas.push(ruta);
      }

      // 2) Crear paciente + caso
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: casoId, ...f, imagenes: rutas }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo crear el caso.');

      // 3) Análisis con IA (si falla, el caso queda guardado y se puede reintentar)
      setPaso('analizando');
      await fetch('/api/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casoId }),
      });

      router.push(`/casos/${casoId}`);
      router.refresh();
    } catch (err) {
      setPaso('formulario');
      setError(
        err instanceof TypeError
          ? 'Sin conexión. Comprueba tu red e inténtalo de nuevo.'
          : err instanceof Error
            ? err.message
            : 'Error inesperado',
      );
    }
  }

  if (paso !== 'formulario') {
    return (
      <div className="tarjeta flex flex-col items-center py-16 text-center">
        <span className="spinner h-10 w-10 border-4 text-clinico-600" />
        <h2 className="mt-6 text-lg font-semibold text-clinico-800">
          {paso === 'subiendo' ? 'Subiendo imágenes…' : 'Analizando con IA…'}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {paso === 'subiendo'
            ? 'Guardando las fotos de forma segura.'
            : 'Evaluando hallazgos, diagnósticos diferenciales y tratamiento. Suele tardar entre 10 y 30 segundos.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <section className="tarjeta">
        <h2 className="mb-4 text-lg font-semibold text-clinico-800">Paciente</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="etiqueta">Nombre (opcional)</label>
            <input className="campo" value={f.nombre} onChange={set('nombre')} placeholder="Ej. Luna" />
          </div>
          <div>
            <label className="etiqueta">Especie *</label>
            <div className="flex gap-2">
              {(['perro', 'gato'] as const).map((esp) => (
                <button
                  key={esp}
                  type="button"
                  onClick={() => setF({ ...f, especie: esp })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                    f.especie === esp
                      ? 'border-clinico-600 bg-clinico-50 text-clinico-800'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {esp === 'perro' ? '🐶' : '🐱'} {esp}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="etiqueta">Raza</label>
            <input className="campo" value={f.raza} onChange={set('raza')} placeholder="Ej. Labrador / Mestizo" />
          </div>
          <div>
            <label className="etiqueta">Edad (años)</label>
            <input className="campo" type="number" step="0.1" min="0" max="40" value={f.edad_anios} onChange={set('edad_anios')} />
          </div>
          <div>
            <label className="etiqueta">Peso (kg)</label>
            <input className="campo" type="number" step="0.1" min="0" max="150" value={f.peso_kg} onChange={set('peso_kg')} />
          </div>
          <div>
            <label className="etiqueta">Sexo</label>
            <select className="campo" value={f.sexo} onChange={set('sexo')}>
              <option value="">No indicado</option>
              <option value="macho">Macho</option>
              <option value="hembra">Hembra</option>
            </select>
          </div>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="mb-4 text-lg font-semibold text-clinico-800">Cuadro clínico</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta">Zona afectada *</label>
            <select className="campo" value={f.zona_afectada} onChange={set('zona_afectada')}>
              {ZONAS.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Tiempo de evolución</label>
            <input className="campo" value={f.tiempo_evolucion} onChange={set('tiempo_evolucion')} placeholder="Ej. 2 semanas" />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta">Síntomas observados</label>
            <textarea
              className="campo min-h-24"
              value={f.sintomas}
              onChange={set('sintomas')}
              placeholder="Prurito intenso, se lame la zona, mal olor, tratamientos previos…"
            />
          </div>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="mb-4 text-lg font-semibold text-clinico-800">Imágenes *</h2>
        <ImageUploader archivos={archivos} onChange={setArchivos} />
        <p className="mt-3 text-xs text-slate-500">
          Consejo: buena luz natural, foco nítido, una foto general y otra de cerca; recorta el pelo si tapa la lesión.
        </p>
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="boton px-6 py-3 text-base">
          Analizar caso
        </button>
      </div>
    </form>
  );
}
