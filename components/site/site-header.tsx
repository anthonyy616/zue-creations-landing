"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SITE_NAME, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/lib/site";
import NavLinks from "./nav";
import ThemeToggle from "./theme-toggle";
import InstagramIcon from "./instagram-icon";
import WhatsAppIcon from "./whatsapp-icon";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export default function SiteHeader() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
        {!isHomePage && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] font-display font-black uppercase tracking-[0.08em] text-fg transition-colors hover:text-accent mr-2"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back
          </Link>
        )}
        <Link
          href="/"
          className="font-display text-sm font-black uppercase tracking-[0.08em] text-fg transition-colors hover:text-accent"
        >
          {SITE_NAME}
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <NavLinks />
        </div>

        <div className="flex items-center gap-2">
          {INSTAGRAM_URL ? (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={
                INSTAGRAM_HANDLE
                  ? `Open Instagram profile ${INSTAGRAM_HANDLE}`
                  : "Open Instagram profile"
              }
              title={INSTAGRAM_HANDLE ? `Instagram — ${INSTAGRAM_HANDLE}` : "Instagram"}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-accent"
            >
              <InstagramIcon size={17} strokeWidth={1.5} />
            </a>
          ) : null}
          {process.env.WHATSAPP_PHONE_NUMBER ? (
            <a
              href={buildWhatsAppUrl("Hello")}
              target="_blank"
              rel="noreferrer"
              aria-label="Open WhatsApp"
              title="WhatsApp"
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-accent"
            >
              <WhatsAppIcon size={17} strokeWidth={1.5} />
            </a>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
      {/* Mobile discipline row (always reachable, no menu required). */}
      <div className="md:hidden">
        <NavLinks mobile />
      </div>
    </header>
  );
}
