type Plan = {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: "Firma Avanzada",
    description: "Ideal para empezar a firmar documentos electrónicos.",
    price: "7000 $",
    period: "/año",
    features: [
      "Certificado en software seguro",
      "Firma de documentos PDF y XML",
      "Renovación online",
      "Soporte por email",
    ],
    cta: "Solicitar",
  },
  {
    name: "Firma Cualificada",
    description: "Máxima validez legal para personas físicas.",
    price: "8500 $",
    period: "/año",
    features: [
      "Certificado cualificado eIDAS",
      "Firma con dispositivo criptográfico",
      "Validez legal en toda la UE",
      "Soporte prioritario e instalación guiada",
      "Renovación automática",
    ],
    cta: "Solicitar",
    featured: true,
  },
  {
    name: "Sello de Empresa",
    description: "El certificado de tu organización para firmar en su nombre.",
    price: "8000 $",
    period: "/año",
    features: [
      "Certificado de sello de empresa (CSE)",
      "Firmas en nombre de la entidad",
      "Gestión de varios usuarios",
      "Ejecución en HSM o nube",
      "Soporte empresarial dedicado",
    ],
    cta: "Solicitar",
  },
];

const checkIcon = {
  className: "size-4 shrink-0",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function Pricing() {
  return (
    <section
      id="planes"
      className="bg-gradient-to-b from-white to-indigo-50/60 py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Planes de firma digital
          </h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Sin permanencia. Elige el certificado que se adapta a tu caso y
            empieza a firmar hoy.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.featured
                  ? "relative rounded-3xl bg-zinc-900 p-8 text-white shadow-xl"
                  : "relative rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm"
              }
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold text-white">
                  Más solicitado
                </span>
              )}
              <h3
                className={
                  plan.featured
                    ? "text-lg font-semibold text-white"
                    : "text-lg font-semibold text-zinc-900"
                }
              >
                {plan.name}
              </h3>
              <p
                className={
                  plan.featured
                    ? "mt-2 text-sm text-zinc-400"
                    : "mt-2 text-sm text-zinc-600"
                }
              >
                {plan.description}
              </p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span
                  className={
                    plan.featured ? "text-sm text-zinc-400" : "text-sm text-zinc-500"
                  }
                >
                  {plan.period}
                </span>
              </p>

              <ul className="mt-8 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start align-center gap-3">
                    <svg {...checkIcon} className="mt-0.5 text-emerald-500 h-[30] w-[30]">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span
                      className={
                        plan.featured ? "text-zinc-300" : "text-zinc-700"
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#contacto"
                className={
                  plan.featured
                    ? "mt-10 block rounded-full bg-indigo-500 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
                    : "mt-10 block rounded-full border border-zinc-300 bg-white px-6 py-3 text-center text-sm font-semibold text-zinc-900 transition-colors hover:border-indigo-400 hover:text-indigo-700"
                }
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}