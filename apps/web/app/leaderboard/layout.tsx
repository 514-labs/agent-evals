import { Nav } from "../../components/nav";
import { Footer } from "../../components/footer";

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground font-[family-name:var(--font-display)] overscroll-none">
      <Nav variant="paper" />

      <div className="max-w-[1070px] mx-auto px-6 lg:px-12">{children}</div>

      <Footer />
    </div>
  );
}
