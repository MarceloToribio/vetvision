import Link from 'next/link';
import type { Analisis } from '@/lib/types';
import { AVISO_LEGAL, CONFIANZA_ESTILO, URGENCIA_ESTILO } from '@/lib/constantes';

function Lista({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-slate-400">—</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <span>{icono}</span> {titulo}
      </h3>
      {children}
    </div>
  );
}

export default function ResultadoAnalisis({ analisis }: { analisis: Analisis }) {
  if (!analisis.imagen_valida) {
    return (
      <div className="tarjeta border-amber-300 bg-amber-50">
        <h2 className="text-lg font-semibold text-amber-900">La imagen no permite un análisis fiable</h2>
        <p className="mt-2 text-sm text-amber-900">{analisis.motivo_si_invalida}</p>
        <p className="mt-3 text-sm text-amber-800">
          Puedes adjuntar una foto mejor en el chat clínico, o{' '}
          <Link href="/casos/nuevo" className="font-medium underline">
            crear un caso nuevo
          </Link>
          .
        </p>
      </div>
    );
  }

  const dp = analisis.diagnostico_principal;
  const urg = analisis.urgencia ? URGENCIA_ESTILO[analisis.urgencia] : null;

  return (
    <div className="tarjeta space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        ⚠️ {AVISO_LEGAL}
      </div>

      {dp && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-500">Diagnóstico más probable</p>
            <span className={`chip ${CONFIANZA_ESTILO[dp.confianza]}`}>Confianza {dp.confianza}</span>
            {urg && <span className={`chip ${urg.clase}`}>{urg.etiqueta}</span>}
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-clinico-800">{dp.nombre}</h2>
          <p className="mt-2 text-sm text-slate-700">{dp.justificacion}</p>
        </div>
      )}

      <Seccion titulo="Hallazgos visuales" icono="🔍">
        <Lista items={analisis.hallazgos_visuales} />
      </Seccion>

      <Seccion titulo="Diagnósticos diferenciales" icono="🧭">
        <div className="space-y-2">
          {analisis.diferenciales.map((d, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <p className="font-medium text-slate-800">{d.nombre}</p>
              <p className="mt-0.5 text-sm text-slate-600">{d.justificacion}</p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Pruebas recomendadas" icono="🧪">
        <Lista items={analisis.pruebas_recomendadas} />
      </Seccion>

      <Seccion titulo="Tratamiento orientativo" icono="💊">
        <div className="space-y-4">
          {analisis.tratamiento.general && <p className="text-sm text-slate-700">{analisis.tratamiento.general}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-slate-800">Farmacológico</p>
              <Lista items={analisis.tratamiento.farmacologico} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-800">Cuidados en casa</p>
              <Lista items={analisis.tratamiento.cuidados_casa} />
            </div>
          </div>
          {analisis.tratamiento.senales_alarma.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="mb-1 text-sm font-medium text-red-800">🚨 Señales de alarma</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">
                {analisis.tratamiento.senales_alarma.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Seccion>
    </div>
  );
}
