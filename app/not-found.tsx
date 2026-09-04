import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-start justify-center px-6 py-24">
      <p className="mono-meta text-[11px] uppercase tracking-[0.24em] text-accent">
        Error 404
      </p>
      <h1 className="font-display mt-4 text-6xl font-black uppercase leading-[0.88] tracking-tight sm:text-8xl">
        Page not
        <br />
        <span className="font-accent-serif font-normal normal-case text-accent">
          found.
        </span>
      </h1>
      <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 border border-line px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-fg transition-colors hover:border-accent hover:text-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.5} /> Back home
      </Link>
    </main>
  );
}
