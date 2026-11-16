import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Acceso directo (sin pantalla de inicio de sesión):
 * si ACCESO_EMAIL y ACCESO_PASSWORD están definidas en el servidor, cada visitante sin sesión
 * entra automáticamente con esa cuenta compartida del equipo. La contraseña nunca llega al navegador.
 * Si no están definidas, la app vuelve a pedir inicio de sesión en /login.
 */
const ACCESO_EMAIL = process.env.ACCESO_EMAIL;
const ACCESO_PASSWORD = process.env.ACCESO_PASSWORD;
const accesoDirecto = Boolean(ACCESO_EMAIL && ACCESO_PASSWORD);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Entrada automática con la cuenta compartida
  if (!user && accesoDirecto) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ACCESO_EMAIL!,
      password: ACCESO_PASSWORD!,
    });
    if (error) console.error('[acceso directo]', error.message);
    user = data.user;
  }

  const { pathname } = request.nextUrl;
  const esLogin = pathname.startsWith('/login');
  const esApi = pathname.startsWith('/api');

  if (!user && !esLogin && !esApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && esLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/casos';
    const redireccion = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    return redireccion;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
