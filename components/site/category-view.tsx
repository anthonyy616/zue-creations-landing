import type { ProjectCard } from "@/lib/public";
import { ProjectListRow, EmptyWork } from "./work-list";

export default function CategoryView({
  title,
  blurb,
  projects,
}: {
  title: string;
  blurb: string;
  projects: ProjectCard[];
}) {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <header className="grid gap-6 border-b border-line py-14 sm:py-20 lg:grid-cols-12">
        <h1 className="font-display text-6xl font-black uppercase leading-[0.85] tracking-tight sm:text-8xl lg:col-span-9">
          {title}
        </h1>
        <div className="flex flex-col justify-end gap-4 lg:col-span-3">
          <p className="max-w-xs text-sm leading-relaxed text-muted">{blurb}</p>
          <p className="mono-meta text-[10px] uppercase tracking-[0.22em] text-accent">
            {String(projects.length).padStart(2, "0")} projects
          </p>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="py-12">
          <EmptyWork label={`${title} work is coming soon.`} />
        </div>
      ) : (
        <ul>
          {projects.map((project, index) => (
            <ProjectListRow key={project.id} project={project} index={index} />
          ))}
        </ul>
      )}
    </div>
  );
}
