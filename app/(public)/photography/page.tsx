import type { Metadata } from "next";
import { getCategoryProjectsWithMedia } from "@/lib/public";
import CategoryView from "@/components/site/category-view";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Photography",
  description:
    "Selected photography work — portraiture, still frames and visual essays.",
  alternates: { canonical: "/photography" },
};

export default async function PhotographyPage() {
  const projects = await getCategoryProjectsWithMedia("photography");
  return (
    <CategoryView
      title="Photography"
      blurb="Still frames and image-led stories — shot for editorial, brands and personal work."
      projects={projects}
    />
  );
}
