import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import AdminNav from "@/components/admin-nav";
import { requireAdminSession } from "@/lib/session";
import {
  getAdminDashboardStats,
  getProjectsForAdmin,
} from "@/lib/projects";
import type { ProjectCategory } from "@/db/schema";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  photography: "Photography",
  cinematography: "Cinematography",
  branding: "Branding",
};

export default async function AdminDashboardPage() {
  if (!(await requireAdminSession())) {
    redirect("/admin/login");
  }

  const [projects, stats] = await Promise.all([
    getProjectsForAdmin(),
    getAdminDashboardStats(),
  ]);

  const categoryCards: { key: ProjectCategory; count: number }[] = (
    ["photography", "cinematography", "branding"] as ProjectCategory[]
  ).map((key) => ({ key, count: stats.perCategory[key] ?? 0 }));

  return (
    <main className="min-h-screen bg-zinc-950">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <Link
            href="/admin/projects"
            className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
          >
            New project
          </Link>
        </div>

        <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Total projects" value={stats.totalProjects} />
          <StatCard label="Media items" value={stats.totalMedia} />
          {categoryCards.map((card) => (
            <StatCard
              key={card.key}
              label={CATEGORY_LABELS[card.key]}
              value={card.count}
            />
          ))}
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Projects</h2>
            <Link
              href="/admin/projects"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Manage all
            </Link>
          </div>

          {projects.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
              No projects yet. Click “New project” to publish your first piece.
            </p>
          ) : (
            <ul className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 last:border-b-0"
                >
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-sm font-medium text-white">
                      {project.title}
                    </span>
                    <span className="block text-xs uppercase tracking-wide text-zinc-500">
                      {CATEGORY_LABELS[project.category]} ·{" "}
                      {format(project.date, "yyyy")}
                      {project.featured ? " · Featured" : ""}
                    </span>
                  </Link>
                  <span className="hidden shrink-0 text-xs text-zinc-600 sm:block">
                    {stats.mediaPerProject[project.id] ?? 0} media
                  </span>
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="shrink-0 rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </p>
    </div>
  );
}