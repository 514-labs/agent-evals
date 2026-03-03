import { Nav } from "../../components/nav";
import { Footer } from "../../components/footer";

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overscroll-none">
      <Nav showLeaderboard={true} activeItem="audit" sticky={true} fullWidth />

      <div className="w-full">{children}</div>

      <Footer />
    </div>
  );
}
