import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { ENQUIRY_FORM_URL } from "@/lib/site";
import { Heartbeat } from "@/components/site/motion";

export const metadata: Metadata = {
  title: "Enquire",
  description:
    "Start a project enquiry — share a few details and receive the right package for the work.",
  alternates: { canonical: "/enquire" },
};

export default function EnquirePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <header className="grid gap-6 border-b border-line py-14 sm:py-20 lg:grid-cols-12">
        <h1 className="font-display text-6xl font-black uppercase leading-[0.85] tracking-tight sm:text-8xl lg:col-span-9">
          Enquire<span className="text-accent">.</span>
        </h1>
        <div className="flex flex-col justify-end gap-4 lg:col-span-3">
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            Tell me about the project. The enquiry flow, package options and
            WhatsApp hand-off are coming together.
          </p>
        </div>
      </header>

      <div className="py-16">
        {ENQUIRY_FORM_URL ? (
          <Heartbeat>
            <a
              href={ENQUIRY_FORM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-line px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-fg transition-colors hover:border-accent hover:text-accent"
            >
              Open the enquiry form <ArrowUpRight size={14} strokeWidth={1.5} />
            </a>
          </Heartbeat>
        ) : (
          <p className="mono-meta text-[11px] uppercase tracking-[0.2em] text-muted">
            The enquiry form link is being configured.
          </p>
        )}
      </div>
    </div>
  );
}
