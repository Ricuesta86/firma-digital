const stats = [
  { value: "15+", label: "años emitiendo certificados" },
  { value: "40.000+", label: "firmas activas" },
  { value: "24 h", label: "tiempo medio de emisión" },
];

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white"
    >
      <div
        className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-indigo-200/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-40 size-72 rounded-full bg-sky-200/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 py-24 text-center sm:py-32">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700">
          Certificados electrónicos con validez legal
        </span>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
          Tu firma digital lista en{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            minutos
          </span>
        </h1>

        <p className="max-w-2xl text-lg leading-8 text-zinc-600">
          Solicita tu certificado de firma digital o el sello de tu empresa y
          firma documentos electrónicos con plena seguridad jurídica y
          reconocimiento legal.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="#contacto"
            className="rounded-full bg-indigo-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
          >
            Solicitar mi firma
          </a>
          <a
            href="#planes"
            className="rounded-full border border-zinc-300 bg-white px-7 py-3 text-base font-semibold text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            Ver planes
          </a>
        </div>

        <dl className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="text-3xl font-bold text-zinc-900">{stat.value}</dt>
              <dd className="mt-1 text-sm text-zinc-500">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}