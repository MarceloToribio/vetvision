import Link from 'next/link';
import { getUsuario } from '@/lib/supabase/server';
import BotonSalir from './BotonSalir';

export default async function Header() {
  const { user } = await getUsuario();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={user ? '/casos' : '/login'} className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-clinico-600 text-lg text-white">
            🐾
          </span>
          <span className="text-lg font-semibold text-clinico-800">VetVision</span>
        </Link>

        {user && (
          <nav className="flex items-center gap-2 text-sm sm:gap-4">
            <Link href="/casos" className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">
              Historial
            </Link>
            <Link href="/casos/nuevo" className="boton py-1.5 text-sm">
              + Nuevo caso
            </Link>
            <BotonSalir />
          </nav>
        )}
      </div>
    </header>
  );
}
