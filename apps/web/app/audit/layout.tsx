import { Nav } from "@/components/nav";

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] font-[family-name:var(--font-display)] overflow-x-hidden">
      <Nav showLeaderboard sticky fullWidth activeItem="audit" />
      <div className="w-full">{children}</div>
    </div>
  );
}
