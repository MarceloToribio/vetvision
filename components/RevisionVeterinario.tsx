'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Caso } from '@/lib/types';

export default function RevisionVeterinario({ caso }: { caso: Caso }) {
  const router = useRouter();
  const [diagnostico, setDiagnostico] = useState(caso.diagnostico_final ?? '');
  const [tratamiento, setTratamiento] = useState(caso.tratamiento_final ?? '');
  const [notas, setNotas] = useState(caso.notas_veterinario ?? '');
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle');

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEstado('guardando');
    try {
      const res = await fetch(`/api/casos/${caso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnostico_final: diagnostico,
          tratamiento_final: tratamiento,
          notas_veterinario: notas,
        }),
      });
      if (!res.ok) throw new Error();
      setEstado('ok');
      router.refresh();
    } catch {
      setEstado('error');
    }
  }

  return (
    <form onSubmit={guardar} className="tarjeta space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-clinico-800">Revisión del veterinario</h2>
        {caso.estado === 'revisado' && <span className="chip bg-clinico-100 text-clinico-800">✓ Revisado</span>}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="etiqueta mb-0">Diagnóstico final</label>
          {caso.diagnostico_ia && (
            <button
              type="button"
              className="text-xs font-medium text-clinico-700 hover:underline"
              onClick={() => setDiagnostico(caso.diagnostico_ia!)}
            >
              Usar diagnóstico de la IA
            </button>
          )}
        </div>
        <input
          className="campo"
          value={diagnostico}
          onChange={(e) => setDiagnostico(e.target.value)}
          placeholder="Confirma o corrige el diagnóstico"
        />
      </div>

      <div>
        <label className="etiqueta">Tratamiento indicado</label>
        <textarea
          className="campo min-h-24"
          value={tratamiento}
          onChange={(e) => setTratamiento(e.target.value)}
          placeholder="Fármacos, dosis, duración, controles…"
        />
      </div>

      <div>
        <label className="etiqueta">Notas</label>
        <textarea className="campo min-h-20" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="boton" disabled={estado === 'guardando'}>
          {estado === 'guardando' && <span className="spinner" />}
          Guardar revisión
        </button>
        {estado === 'ok' && <span className="text-sm text-clinico-700">Guardado ✓</span>}
        {estado === 'error' && <span className="text-sm text-red-600">No se pudo guardar. Reintenta.</span>}
      </div>
    </form>
  );
}
