'use client';

import { MAX_BYTES } from './constantes';

const LADO_MAXIMO = 1600; // px: suficiente detalle clínico y menos tokens para la IA

function esHeic(file: File) {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Prepara una imagen antes de subirla:
 * 1) valida formato y tamaño, 2) convierte HEIC → JPEG, 3) reduce a 1600 px como máximo.
 * Devuelve siempre un JPEG (o el original si ya es pequeño y compatible).
 */
export async function prepararImagen(file: File): Promise<File> {
  const formatoOk = /image\/(jpeg|png|webp)/.test(file.type) || esHeic(file);
  if (!formatoOk) throw new Error(`"${file.name}": formato no permitido. Usa JPG, PNG o HEIC.`);
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" supera los 10 MB.`);

  let blob: Blob = file;
  if (esHeic(file)) {
    const heic2any = (await import('heic2any')).default;
    const convertido = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    blob = Array.isArray(convertido) ? convertido[0] : convertido;
  }

  const bitmap = await createImageBitmap(blob);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.88),
  );
  const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([jpeg], nombre, { type: 'image/jpeg' });
}
