import { Nav } from "../../components/nav";
import { Footer } from "../../components/footer";

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overscroll-none">
      <Nav showLeaderboard={true} activeItem="leaderboard" sticky={true} />

      <div className="max-w-6xl mx-auto px-6 lg:px-12">{children}</div>

      <Footer />
    </div>
  );
}
