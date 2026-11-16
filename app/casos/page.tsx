import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUsuario } from '@/lib/supabase/server';
import { URGENCIA_ESTILO } from '@/lib/constantes';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'bg-slate-100 text-slate-700' },
  analizado: { texto: 'Analizado', clase: 'bg-sky-100 text-sky-800' },
  revisado: { texto: 'Revisado', clase: 'bg-clinico-100 text-clinico-800' },
  error: { texto: 'Error', clase: 'bg-red-100 text-red-700' },
};

type Filtros = { q?: string; especie?: string; desde?: string; hasta?: string };

export default async function HistorialPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const { q = '', especie = '', desde = '', hasta = '' } = await searchParams;
  const { supabase, user } = await getUsuario();
  if (!user) redirect('/login');

  let consulta = supabase
    .from('casos')
    .select('id, zona_afectada, estado, urgencia, diagnostico_ia, diagnostico_final, creado_en, pacientes!inner(nombre, especie, raza)')
    .order('creado_en', { ascending: false })
    .limit(100);

  if (especie === 'perro' || especie === 'gato') consulta = consulta.eq('pacientes.especie', especie);
  if (desde) consulta = consulta.gte('creado_en', `${desde}T00:00:00`);
  if (hasta) consulta = consulta.lte('creado_en', `${hasta}T23:59:59`);
  const termino = q.replace(/[,()%*\\]/g, ' ').trim(); // evita romper la sintaxis del filtro
  if (termino) {
    consulta = consulta.or(`diagnostico_ia.ilike.%${termino}%,diagnostico_final.ilike.%${termino}%,zona_afectada.ilike.%${termino}%`);
  }

  const { data: casos, error } = await consulta;

  type Fila = {
    id: string;
    zona_afectada: string;
    estado: string;
    urgencia: string | null;
    diagnostico_ia: string | null;
    diagnostico_final: string | null;
    creado_en: string;
    pacientes: { nombre: string | null; especie: string; raza: string | null };
  };
  const filas = (casos ?? []) as unknown as Fila[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-clinico-800">Historial de casos</h1>
        <Link href="/casos/nuevo" className="boton">
          + Nuevo caso
        </Link>
      </div>

      <form method="get" className="tarjeta grid gap-3 sm:grid-cols-[1fr_150px_160px_160px_auto]">
        <input name="q" defaultValue={q} className="campo" placeholder="Buscar por diagnóstico o zona…" />
        <select name="especie" defaultValue={especie} className="campo">
          <option value="">Todas las especies</option>
          <option value="perro">Perros</option>
          <option value="gato">Gatos</option>
        </select>
        <input type="date" name="desde" defaultValue={desde} className="campo" aria-label="Desde" />
        <input type="date" name="hasta" defaultValue={hasta} className="campo" aria-label="Hasta" />
        <div className="flex gap-2">
          <button className="boton">Filtrar</button>
          <Link href="/casos" className="boton-secundario">
            Limpiar
          </Link>
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">No se pudo cargar el historial.</p>}

      {filas.length === 0 ? (
        <div className="tarjeta py-12 text-center text-slate-500">
          {q || especie || desde || hasta ? 'No hay casos con esos filtros.' : 'Todavía no hay casos. ¡Crea el primero!'}
        </div>
      ) : (
        <ul className="grid gap-3">
          {filas.map((c) => {
            const urg = c.urgencia ? URGENCIA_ESTILO[c.urgencia] : null;
            const est = ESTADO[c.estado];
            return (
              <li key={c.id}>
                <Link
                  href={`/casos/${c.id}`}
                  className="tarjeta flex flex-wrap items-center gap-4 p-4 transition hover:border-clinico-300 hover:shadow"
                >
                  <span className="text-3xl">{c.pacientes.especie === 'perro' ? '🐶' : '🐱'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">
                      {c.diagnostico_final || c.diagnostico_ia || 'Sin diagnóstico'}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {c.pacientes.nombre || 'Sin nombre'}
                      {c.pacientes.raza ? ` · ${c.pacientes.raza}` : ''} · {c.zona_afectada}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {urg && <span className={`chip ${urg.clase}`}>{urg.etiqueta}</span>}
                    <span className={`chip ${est.clase}`}>{est.texto}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.creado_en).toLocaleDateString('es', { dateStyle: 'medium' })}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
