'use client';

import { useState } from 'react';
import type { DatosInforme } from './pdf/InformePDF';

type Props = Omit<DatosInforme, 'imagenes' | 'chat'> & {
  urlsImagenes: string[];
  chat: DatosInforme['chat'];
};

async function aDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Genera el informe PDF en el navegador (no consume recursos del servidor). */
export default function BotonPDF({ urlsImagenes, chat, ...datos }: Props) {
  const [incluirChat, setIncluirChat] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(false);

  async function generar() {
    setGenerando(true);
    setError(false);
    try {
      const [{ pdf }, { default: InformePDF }, imagenes] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./pdf/InformePDF'),
        Promise.all(urlsImagenes.map(aDataUrl)),
      ]);
      const blob = await pdf(
        <InformePDF {...datos} imagenes={imagenes} chat={incluirChat ? chat : null} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nombre = (datos.paciente.nombre || datos.paciente.especie).replace(/\s+/g, '_');
      a.download = `informe_${nombre}_${datos.caso.creado_en.slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {chat && chat.length > 0 && (
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={incluirChat} onChange={(e) => setIncluirChat(e.target.checked)} />
          Incluir chat
        </label>
      )}
      <button className="boton-secundario" onClick={generar} disabled={generando}>
        {generando ? <span className="spinner" /> : '📄'} Exportar PDF
      </button>
      {error && <span className="text-sm text-red-600">No se pudo generar el PDF.</span>}
    </div>
  );
}
