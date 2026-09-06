import Link from "next/link";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { SITE_NAME, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/lib/site";
import InstagramIcon from "./instagram-icon";
import { safeInstagramUrl } from "@/lib/sanitize";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-xs">
            <Link
              href="/"
              className="font-display text-sm font-black uppercase tracking-[0.08em] text-fg"
            >
              {SITE_NAME}
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Photography, cinematography and branding — told as visual
              stories.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="mono-meta text-[10px] uppercase tracking-[0.2em] text-muted">
                Work
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="text-muted transition-colors hover:text-accent" href="/photography">Photography</Link></li>
                <li><Link className="text-muted transition-colors hover:text-accent" href="/cinematography">Cinematography</Link></li>
                <li><Link className="text-muted transition-colors hover:text-accent" href="/branding">Branding</Link></li>
              </ul>
            </div>
            <div>
              <p className="mono-meta text-[10px] uppercase tracking-[0.2em] text-muted">
                Contact Us
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link className="text-muted transition-colors hover:text-accent" href="/enquire">
                    Enquire <ArrowUpRight size={13} className="inline" strokeWidth={1.5} />
                  </Link>
                </li>
                {INSTAGRAM_URL && safeInstagramUrl(INSTAGRAM_URL) ? (
                  <li>
                    <a
                      href={safeInstagramUrl(INSTAGRAM_URL) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted transition-colors hover:text-accent inline-flex items-center gap-1"
                      aria-label="Open Instagram profile"
                    >
                      <InstagramIcon size={13} className="shrink-0" strokeWidth={1.5} />
                      {INSTAGRAM_HANDLE || "Instagram"}
                    </a>
                  </li>
                ) : null}
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted transition-colors hover:text-accent inline-flex items-center gap-1"
                  >
                    <MessageSquare size={13} className="shrink-0" strokeWidth={1.5} />
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {SITE_NAME}. All rights reserved.</p>
          <p className="mono-meta">Photography · Cinematography · Branding</p>
        </div>
      </div>
    </footer>
  );
}
