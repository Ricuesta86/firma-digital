type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const iconProps = {
  className: "size-6",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const features: Feature[] = [
  {
    title: "Validez jurídica",
    description:
      "Firmas electrónicas cualificadas con pleno valor legal y reconocimiento en toda la Unión Europea.",
    icon: (
      <svg {...iconProps}>
        <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Seguridad de nivel bancario",
    description:
      "Tu clave privada se genera y almacena en un dispositivo criptográfico seguro: chip, tarjeta o HSM.",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: "Emisión en 24 horas",
    description:
      "Proceso de solicitud y verificación simplificado para que firmes tus primeros documentos al día siguiente.",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: "Soporte multi-formato",
    description:
      "Firma PDF, Word, XML o formularios electrónicos sin instalar complementos adicionales en tu equipo.",
    icon: (
      <svg {...iconProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="m9 13 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Asesoría personalizada",
    description:
      "Un equipo técnico te acompaña en la configuración, instalación y primeros pasos con tu certificado.",
    icon: (
      <svg {...iconProps}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Renovación sin fricción",
    description:
      "Te avisamos antes del vencimiento y renovamos tu certificado sin que tengas que volver a la sede.",
    icon: (
      <svg {...iconProps}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M20 6v4h-4" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="caracteristicas" className="bg-white py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            ¿Por qué elegir FirmaDigital?
          </h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Emitimos certificados electrónicos de las máximas garantías,
            diseñados para la cantidad de documentos y trámites que firmas
            cada día.
          </p>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="group rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition-transform group-hover:scale-105">
                {feature.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-zinc-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}