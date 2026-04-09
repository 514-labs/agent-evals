import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground font-[family-name:var(--font-display)] overflow-x-hidden">
      <Nav variant="paper" />
      <div className="w-full">{children}</div>
      <Footer />
    </div>
  );
}
