'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [clinica, setClinica] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);
    const supabase = createClient();

    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/casos');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nombre, clinica } },
        });
        if (error) throw error;
        if (data.session) {
          router.push('/casos');
          router.refresh();
        } else {
          setAviso('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
          setModo('entrar');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : msg);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md">
      <div className="tarjeta">
        <h1 className="text-2xl font-semibold text-clinico-800">
          {modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Asistente de diagnóstico por imágenes para veterinarios.</p>

        <form onSubmit={enviar} className="mt-6 space-y-4">
          {modo === 'registro' && (
            <>
              <div>
                <label className="etiqueta">Nombre completo</label>
                <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div>
                <label className="etiqueta">Clínica</label>
                <input className="campo" value={clinica} onChange={(e) => setClinica(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="etiqueta">Email</label>
            <input
              type="email"
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="etiqueta">Contraseña</label>
            <input
              type="password"
              className="campo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {aviso && <p className="rounded-lg bg-clinico-50 p-3 text-sm text-clinico-800">{aviso}</p>}

          <button type="submit" className="boton w-full" disabled={cargando}>
            {cargando && <span className="spinner" />}
            {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-clinico-700 hover:underline"
          onClick={() => {
            setModo(modo === 'entrar' ? 'registro' : 'entrar');
            setError(null);
          }}
        >
          {modo === 'entrar' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
}
