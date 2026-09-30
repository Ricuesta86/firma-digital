import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Pricing } from "@/components/pricing";
import { ContactForm } from "@/components/contact-form";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <Pricing />

        <section id="contacto" className="bg-white py-24">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Solicita tu firma digital
              </h2>
              <p className="mt-4 text-lg leading-8 text-zinc-600">
                Cuéntanos qué certificado necesitas y nuestro equipo te
                contactará con los siguientes pasos y la documentación
                requerida.
              </p>

              <ul className="mt-8 space-y-4 text-sm text-zinc-700">
                {[
                  "Respuesta en menos de 24 horas laborables.",
                  "Proceso de verificación por videollamada o sede.",
                  "Precios cerrados y sin costes ocultos.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 size-5 shrink-0 text-emerald-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <ContactForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}