"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import type { PackageDef, PackageTier } from "@/lib/packages";
import { enquiryMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

interface PackagesShellProps {
  photography: PackageDef[];
  cinematography: PackageDef[];
  branding: PackageDef[];
  all: PackageDef[];
  photographyRange: string;
  cinematographyRange: string;
  brandingRange: string;
  allRange: string;
}

const TIER_LABELS: Record<PackageTier, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

function PackageCard({
  pkg,
  selected,
  onToggle,
}: {
  pkg: PackageDef;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`rounded-lg border bg-zinc-950 p-6 transition-colors ${
        selected
          ? "border-accent ring-1 ring-accent/30"
          : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${
            pkg.tier === "premium"
              ? "bg-accent/10 text-accent"
              : pkg.tier === "standard"
              ? "bg-zinc-800 text-zinc-300"
              : "bg-zinc-800/50 text-zinc-500"
          }`}
        >
          {TIER_LABELS[pkg.tier]}
        </span>
        {pkg.featured && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
            Recommended
          </span>
        )}
      </div>

      <h3 className="font-display text-xl font-bold uppercase tracking-tight text-fg">
        {pkg.name}
      </h3>
      <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-accent">
        {pkg.price}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{pkg.tagline}</p>

      {pkg.description && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {pkg.description}
        </p>
      )}

      <ul className="mt-4 space-y-1.5">
        {pkg.includes.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-zinc-300"
          >
            <Check
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-accent mt-0.5"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onToggle}
        className={`mt-5 w-full rounded border px-4 py-2.5 text-sm font-medium uppercase tracking-[0.18em] transition-colors ${
          selected
            ? "border-accent/40 bg-accent/5 text-accent"
            : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
        }`}
      >
        {selected ? "Selected — click to deselect" : "Select this package"}
      </button>
    </article>
  );
}

export default function PackagesShell({
  photography,
  cinematography,
  branding,
  all,
  photographyRange,
  cinematographyRange,
  brandingRange,
  allRange,
}: PackagesShellProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  function toggle(pkg: PackageDef) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg.id)) next.delete(pkg.id);
      else next.add(pkg.id);
      return next;
    });
  }

  function selectedPackages(): PackageDef[] {
    return all.filter((p) => selected.has(p.id));
  }

  async function buildLink() {
    const packs = selectedPackages();
    if (packs.length === 0) return;

    setBuilding(true);
    try {
      const msg = enquiryMessage({
        packages: packs,
        projectType: "Photography / Cinematography / Branding",
        budget: packs.map((p) => p.price).join("; "),
        timeline: "Flexible",
      });
      setMessage(msg);
      const url = buildWhatsAppUrl(msg);
      setLink(url);
    } finally {
      setBuilding(false);
    }
  }

  function openWhatsApp() {
    if (!link) return;
    window.location.href = link;
  }

  const counts = {
    photography: photography.filter((p) => selected.has(p.id)).length,
    cinematography: cinematography.filter((p) => selected.has(p.id)).length,
    branding: branding.filter((p) => selected.has(p.id)).length,
    all: selected.size,
  };

  return (
    <div>
      {/* Summary bar — shows how many selected per category */}
      <div className="mb-10 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
        <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
          Selected
        </span>
        {(["photography", "cinematography", "branding"] as const).map(
          (cat) => (
            <span
              key={cat}
              className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${
                counts[cat] > 0
                  ? "bg-accent/10 text-accent"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {cat === "photography" && `${counts.photography} photo`}
              {cat === "cinematography" &&
                `${counts.cinematography} film`}
              {cat === "branding" && `${counts.branding} brand`}
            </span>
          )
        )}
        {counts.all > 0 && (
          <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            {counts.all} package{counts.all !== 1 ? "s" : ""} selected
          </span>
        )}
        {counts.all === 0 && (
          <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            Pick packages above, then continue to WhatsApp
          </span>
        )}
      </div>

      {/* Photography */}
      <section className="mb-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Photography
          </h2>
          <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
            {photographyRange}
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photography.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={selected.has(pkg.id)}
              onToggle={() => toggle(pkg)}
            />
          ))}
        </div>
      </section>

      {/* Cinematography */}
      <section className="mb-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Cinematography
          </h2>
          <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
            {cinematographyRange}
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cinematography.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={selected.has(pkg.id)}
              onToggle={() => toggle(pkg)}
            />
          ))}
        </div>
      </section>

      {/* Branding */}
      <section className="mb-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Branding
          </h2>
          <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
            {brandingRange}
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branding.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={selected.has(pkg.id)}
              onToggle={() => toggle(pkg)}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="border-t border-line pt-12">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Ready to start?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {counts.all > 0
                ? `You've picked ${counts.all} package${counts.all !== 1 ? "s" : ""}. Continue to WhatsApp and I'll get back to you with availability and next steps.`
                : "Select a package above to pre-fill a WhatsApp message."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end sm:min-w-[280px]">
            {counts.all === 0 ? (
              <button
                type="button"
                onClick={buildLink}
                disabled={building}
                className="cursor-not-allowed rounded border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 disabled:opacity-40"
              >
                {building ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Building…
                  </span>
                ) : (
                  "Select a package first"
                )}
              </button>
            ) : link ? (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/5 px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/10"
              >
                Open WhatsApp <ArrowUpRight size={14} strokeWidth={1.5} />
              </a>
            ) : (
              <button
                type="button"
                onClick={buildLink}
                disabled={building}
                className="rounded border border-accent/40 bg-accent/5 px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
              >
                {building ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Building…
                  </span>
                ) : (
                  "Continue to WhatsApp"
                )}
              </button>
            )}
          </div>
        </div>

        {message && (
          <pre className="mt-4 max-w-2xl rounded border border-zinc-800 bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-300">
            {message}
          </pre>
        )}
      </div>
    </div>
  );
}
