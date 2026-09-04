"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PUBLIC_LINKS = [
  { href: "/photography", label: "Photography" },
  { href: "/cinematography", label: "Cinematography" },
  { href: "/branding", label: "Branding" },
] as const;

export default function NavLinks({
  className = "",
  itemClassName = "",
  mobile = false,
}: {
  /** Extra classes for the wrapping <nav>. */
  className?: string;
  /** Extra classes for each <a>. */
  itemClassName?: string;
  /** Render as the compact mobile row (smaller type, overflow scroll). */
  mobile?: boolean;
}) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <div className={className} role="navigation" aria-label="Disciplines">
        <ul className="flex items-center gap-5 overflow-x-auto px-6 pb-3">
          {PUBLIC_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-[11px] uppercase tracking-[0.18em] ${
                    active ? "text-accent" : "text-muted hover:text-fg"
                  } transition-colors ${itemClassName}`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <nav className={className} aria-label="Disciplines">
      <ul className="flex items-center gap-7">
        {PUBLIC_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-fg"
                } ${itemClassName}`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
