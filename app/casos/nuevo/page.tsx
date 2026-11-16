import FormularioCaso from '@/components/FormularioCaso';

export default function NuevoCasoPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-clinico-800">Nuevo caso</h1>
      <p className="mb-6 text-sm text-slate-500">
        Completa los datos del paciente y sube las fotos de la lesión para el análisis.
      </p>
      <FormularioCaso />
    </div>
  );
}
