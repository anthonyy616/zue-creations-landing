import type { Metadata } from "next";
import { orderedPackages, priceRangeFor } from "@/lib/packages";
import PackagesShell from "./packages-shell";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Film, photography and branding packages — from a single frame to a full campaign. Pick what fits and start an enquiry.",
  alternates: { canonical: "/packages" },
};

export default async function PackagesPage() {
  const all = orderedPackages();
  const photography = orderedPackages("photography");
  const cinematography = orderedPackages("cinematography");
  const branding = orderedPackages("branding");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-12">
        <p className="mono-meta text-[11px] uppercase tracking-[0.24em] text-accent">
          Photography · Cinematography · Branding
        </p>
        <h1 className="font-display mt-6 text-5xl font-black uppercase leading-[0.88] tracking-tight sm:text-7xl">
          Packages
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Every project is different, so packages are starting points rather
          than fixed menus. Pick the one closest to what you have in mind and
          we&apos;ll shape the rest together.
        </p>
      </header>

      <PackagesShell
        photography={photography}
        cinematography={cinematography}
        branding={branding}
        all={all}
        photographyRange={priceRangeFor("photography")}
        cinematographyRange={priceRangeFor("cinematography")}
        brandingRange={priceRangeFor("branding")}
      />
    </main>
  );
}
