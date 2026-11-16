'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function BotonSalir() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}
