"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/projects", label: "Projects" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <nav className="flex items-center gap-6">
        <span className="text-sm font-semibold uppercase tracking-widest text-white">
          Admin
        </span>
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "text-sm text-white"
                  : "text-sm text-zinc-500 hover:text-zinc-300"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <form action={logout}>
        <button
          type="submit"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Log out
        </button>
      </form>
    </header>
  );
}
