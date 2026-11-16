/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las imágenes se suben directamente del navegador a Supabase Storage
  // (evita el límite de ~4.5 MB por petición de las funciones serverless en Vercel).
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
