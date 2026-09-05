import SiteHeader from "@/components/site/site-header";
import SiteFooter from "@/components/site/site-footer";
import PageTransition from "@/components/site/page-transition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-bg text-fg">
      {/* Ambient olive gradient wash behind everything. */}
      <div
        aria-hidden="true"
        className="bg-aura pointer-events-none absolute inset-0 z-0"
      />
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
