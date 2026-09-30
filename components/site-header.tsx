import Link from "next/link";

const navLinks = [
  { href: "#caracteristicas", label: "Características" },
  { href: "#planes", label: "Planes" },
  { href: "#contacto", label: "Contacto" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="#inicio"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
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
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 sm:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-zinc-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#contacto"
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Solicitar firma
        </a>
      </div>
    </header>
  );
}