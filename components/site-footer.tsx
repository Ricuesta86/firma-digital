const footerLinks = [
  { href: "#caracteristicas", label: "Características" },
  { href: "#planes", label: "Planes" },
  { href: "#contacto", label: "Contacto" },
];

export function SiteFooter() {
  return (
    <footer className="bg-zinc-950 py-14 text-zinc-400">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            FirmaDigital
          </p>
          <p className="mt-3 text-sm leading-6">
            Emisión de certificados y firmas digitales con validez legal.
          </p>
        </div>

        <nav aria-label="Enlaces del pie de página">
          <p className="text-sm font-semibold text-white">Enlaces</p>
          <ul className="mt-3 space-y-2 text-sm">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-white">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href="mailto:solicitudes@firmadigital.es"
                className="transition-colors hover:text-white"
              >
                solicitudes@firmadigital.es
              </a>
            </li>
            <li>
              <a
                href="tel:+34900000000"
                className="transition-colors hover:text-white"
              >
                +34 900 000 000
              </a>
            </li>
            <li>Madrid, España</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 w-full max-w-6xl border-t border-zinc-800 px-6 pt-6 text-xs text-zinc-500">
        © {new Date().getFullYear()} FirmaDigital. Todos los derechos
        reservados.
      </div>
    </footer>
  );
}