/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las imágenes se suben directamente del navegador a Supabase Storage
  // (evita el límite de ~4.5 MB por petición de las funciones serverless).
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  // La comprobación de tipos y el lint se ejecutan en desarrollo (npm run lint / tsc);
  // no bloquean el build de producción.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
