'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BotonAnalizar({ casoId, etiqueta = 'Analizar con IA' }: { casoId: string; etiqueta?: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analizar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casoId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      setError(e instanceof TypeError ? 'Sin conexión.' : e instanceof Error ? e.message : 'Error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <button className="boton" onClick={analizar} disabled={cargando}>
        {cargando && <span className="spinner" />}
        {cargando ? 'Analizando…' : etiqueta}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
