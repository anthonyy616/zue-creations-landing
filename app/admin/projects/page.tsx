import { redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";
import { requireAdminSession } from "@/lib/session";
import { getProjectsForAdmin } from "@/lib/projects";
import ProjectsManager from "./projects-manager";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  if (!(await requireAdminSession())) {
    redirect("/admin/login");
  }

  const projects = await getProjectsForAdmin();

  return (
    <main className="min-h-screen bg-zinc-950">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <ProjectsManager initialProjects={projects} />
      </div>
    </main>
  );
}
