import type { Metadata } from "next";
import { getCategoryProjects } from "@/lib/public";
import CategoryView from "@/components/site/category-view";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Branding",
  description:
    "Selected branding and art-direction work — identity, campaigns and visual systems.",
  alternates: { canonical: "/branding" },
};

export default async function BrandingPage() {
  const projects = await getCategoryProjects("branding");
  return (
    <CategoryView
      title="Branding"
      blurb="Identity, art direction and campaign work — ideas made visible and consistent."
      projects={projects}
    />
  );
}
