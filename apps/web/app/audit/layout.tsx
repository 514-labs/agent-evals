import { Nav } from "@/components/nav";

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overflow-x-hidden">
      <Nav showLeaderboard sticky fullWidth activeItem="audit" />
      <div className="w-full">{children}</div>
    </div>
  );
}
