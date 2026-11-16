'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { prepararImagen } from '@/lib/imagen';
import { BUCKET } from '@/lib/constantes';

interface MensajeUI {
  id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  imagenes: string[]; // URLs para mostrar
}

interface Props {
  casoId: string;
  mensajesIniciales: MensajeUI[];
  diagnostico: string | null;
}

const ATAJOS = [
  {
    etiqueta: 'Ver diferenciales',
    texto:
      'Compara en una tabla el diagnóstico principal con los diferenciales: hallazgos a favor, en contra y la prueba que mejor los distingue.',
  },
  {
    etiqueta: 'Ajustar tratamiento',
    texto:
      'Propón un plan de tratamiento detallado para este paciente: principios activos, dosis calculadas para su peso, vía, frecuencia, duración y controles. Señala contraindicaciones para su especie y raza.',
  },
  {
    etiqueta: 'Explicar al dueño',
    texto:
      'Redacta una explicación para el propietario, en lenguaje sencillo y cálido, del diagnóstico, el tratamiento, los cuidados en casa y cuándo volver urgentemente.',
  },
  {
    etiqueta: 'Pronóstico',
    texto: '¿Cuál es el pronóstico esperado, el tiempo de respuesta al tratamiento y qué factores pueden empeorarlo?',
  },
];

export default function ChatClinico({ casoId, mensajesIniciales, diagnostico }: Props) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>(mensajesIniciales);
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const inputImg = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensajes]);

  async function adjuntar(lista: FileList) {
    setError(null);
    try {
      const nuevos = await Promise.all(Array.from(lista).slice(0, 3 - adjuntos.length).map(prepararImagen));
      setAdjuntos([...adjuntos, ...nuevos]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imagen no válida');
    }
  }

  async function enviar(contenido: string) {
    const limpio = contenido.trim();
    if ((!limpio && adjuntos.length === 0) || enviando) return;
    setError(null);
    setEnviando(true);

    const previews = adjuntos.map((f) => URL.createObjectURL(f));
    const idAsistente = crypto.randomUUID();
    setMensajes((m) => [
      ...m,
      { id: crypto.randomUUID(), rol: 'user', contenido: limpio || '(imagen de seguimiento)', imagenes: previews },
      { id: idAsistente, rol: 'assistant', contenido: '', imagenes: [] },
    ]);
    setTexto('');
    const archivos = adjuntos;
    setAdjuntos([]);

    try {
      // Subir imágenes de seguimiento al bucket
      const rutas: string[] = [];
      if (archivos.length) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
        for (const f of archivos) {
          const ruta = `${user.id}/${casoId}/seguimiento-${crypto.randomUUID()}.jpg`;
          const { error } = await supabase.storage.from(BUCKET).upload(ruta, f, { contentType: f.type });
          if (error) throw new Error('No se pudo subir la imagen.');
          rutas.push(ruta);
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casoId, mensaje: limpio, imagenes: rutas }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'La IA no pudo responder.');
      }

      // Lectura del streaming
      const lector = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        const trozo = decoder.decode(value, { stream: true });
        setMensajes((m) => m.map((x) => (x.id === idAsistente ? { ...x, contenido: x.contenido + trozo } : x)));
      }
    } catch (e) {
      setMensajes((m) => m.filter((x) => x.id !== idAsistente || x.contenido));
      setError(e instanceof TypeError ? 'Sin conexión. Revisa tu red.' : e instanceof Error ? e.message : 'Error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta flex h-[75vh] flex-col p-0">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-lg font-semibold text-clinico-800">💬 Chat clínico</h2>
        <p className="text-xs text-slate-500">La IA conoce todos los datos, imágenes y el análisis del caso.</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {mensajes.length === 0 && (
          <div className="rounded-xl bg-clinico-50 p-4 text-sm text-clinico-900">
            Pregunta lo que necesites sobre el caso{diagnostico ? <> de <b>{diagnostico}</b></> : null}: diferenciales,
            dosis, alternativas terapéuticas, pruebas o un texto para el propietario. También puedes adjuntar fotos de
            seguimiento para evaluar la evolución.
          </div>
        )}

        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 ${
                m.rol === 'user' ? 'bg-clinico-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              {m.imagenes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.imagenes.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="Seguimiento" className="h-24 w-24 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              {m.rol === 'assistant' ? (
                m.contenido ? (
                  <div className="prose prose-sm prose-slate max-w-none prose-table:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.contenido}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="spinner" /> Pensando…
                  </span>
                )
              ) : (
                <p className="whitespace-pre-wrap text-sm">{m.contenido}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {ATAJOS.map((a) => (
            <button
              key={a.etiqueta}
              className="rounded-full border border-clinico-200 bg-clinico-50 px-3 py-1 text-xs font-medium text-clinico-800 hover:bg-clinico-100 disabled:opacity-50"
              disabled={enviando}
              onClick={() => enviar(a.texto)}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>

        {adjuntos.length > 0 && (
          <div className="mb-2 flex gap-2">
            {adjuntos.map((f, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <button
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-black/70 text-xs text-white"
                  onClick={() => setAdjuntos(adjuntos.filter((_, j) => j !== i))}
                  aria-label="Quitar"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
        >
          <button
            type="button"
            className="boton-secundario px-3"
            title="Adjuntar imagen de seguimiento"
            disabled={enviando || adjuntos.length >= 3}
            onClick={() => inputImg.current?.click()}
          >
            📎
          </button>
          <input
            ref={inputImg}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) adjuntar(e.target.files);
              e.target.value = '';
            }}
          />
          <textarea
            className="campo max-h-40 min-h-[42px] flex-1 resize-none"
            rows={1}
            value={texto}
            placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter nueva línea)"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
          />
          <button type="submit" className="boton" disabled={enviando || (!texto.trim() && !adjuntos.length)}>
            {enviando ? <span className="spinner" /> : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
}
