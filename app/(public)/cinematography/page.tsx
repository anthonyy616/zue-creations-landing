import type { Metadata } from "next";
import { getCategoryProjectsWithMedia } from "@/lib/public";
import CategoryView from "@/components/site/category-view";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Cinematography",
  description:
    "Selected cinematography work — motion, film and image-led storytelling.",
  alternates: { canonical: "/cinematography" },
};

export default async function CinematographyPage() {
  const projects = await getCategoryProjectsWithMedia("cinematography");
  return (
    <CategoryView
      title="Cinematography"
      blurb="Moving image — short films, campaigns and visual stories shot in motion."
      projects={projects}
    />
  );
}
