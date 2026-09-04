import { notFound, redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";
import { requireAdminSession } from "@/lib/session";
import { getProjectById } from "@/lib/projects";
import { getMediaByProject, buildMediaView } from "@/lib/media";
import ProjectForm from "../project-form";
import MediaManager from "../media-manager";

export const dynamic = "force-dynamic";

export default async function AdminProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await requireAdminSession())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const mediaRows = await getMediaByProject(id);

  return (
    <main className="min-h-screen bg-zinc-950">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold text-white">
          Edit project
        </h1>
        <section className="mb-10 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <ProjectForm project={project} backHref="/admin/projects" />
        </section>
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <MediaManager
            projectId={project.id}
            initialMedia={mediaRows.map(buildMediaView)}
          />
        </section>
      </div>
    </main>
  );
}
