'use client';

import { useEffect, useRef, useState } from 'react';
import { prepararImagen } from '@/lib/imagen';
import { MAX_IMAGENES } from '@/lib/constantes';

interface Props {
  archivos: File[];
  onChange: (archivos: File[]) => void;
  disabled?: boolean;
}

/** Carga de 1 a 5 imágenes: arrastrar y soltar, galería o cámara, con vista previa. */
export default function ImageUploader({ archivos, onChange, disabled }: Props) {
  const inputGaleria = useRef<HTMLInputElement>(null);
  const inputCamara = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = archivos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [archivos]);

  async function agregar(lista: FileList | File[]) {
    setError(null);
    const nuevos = Array.from(lista);
    const disponibles = MAX_IMAGENES - archivos.length;
    if (nuevos.length > disponibles) {
      setError(`Máximo ${MAX_IMAGENES} imágenes por caso.`);
    }
    setProcesando(true);
    const listos: File[] = [];
    for (const f of nuevos.slice(0, Math.max(0, disponibles))) {
      try {
        listos.push(await prepararImagen(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo procesar una imagen.');
      }
    }
    setProcesando(false);
    if (listos.length) onChange([...archivos, ...listos]);
  }

  const lleno = archivos.length >= MAX_IMAGENES;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !lleno) setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (!disabled && !lleno) agregar(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
          arrastrando ? 'border-clinico-500 bg-clinico-50' : 'border-slate-300 bg-slate-50'
        } ${disabled || lleno ? 'opacity-60' : ''}`}
      >
        <div className="text-3xl">📷</div>
        <p className="mt-2 text-sm text-slate-600">
          Arrastra aquí las fotos de la lesión o selecciónalas
          <br />
          <span className="text-xs text-slate-400">JPG, PNG o HEIC · máx. 10 MB · hasta {MAX_IMAGENES} imágenes</span>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="boton-secundario text-sm"
            disabled={disabled || lleno || procesando}
            onClick={() => inputGaleria.current?.click()}
          >
            Elegir archivos
          </button>
          <button
            type="button"
            className="boton-secundario text-sm"
            disabled={disabled || lleno || procesando}
            onClick={() => inputCamara.current?.click()}
          >
            Tomar foto
          </button>
        </div>
        <input
          ref={inputGaleria}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) agregar(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={inputCamara}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            if (e.target.files) agregar(e.target.files);
            e.target.value = '';
          }}
        />
        {procesando && (
          <p className="mt-3 flex items-center gap-2 text-sm text-clinico-700">
            <span className="spinner" /> Procesando imágenes…
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {previews.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {previews.map((src, i) => (
            <li key={src} className="group relative aspect-square overflow-hidden rounded-xl border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  aria-label="Quitar imagen"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                  onClick={() => onChange(archivos.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
