import { Nav } from "../../components/nav";
import { Footer } from "../../components/footer";
import { upNext } from "../../flags";

export default async function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showUpNext = await upNext();

  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overscroll-none">
      <Nav
        showLeaderboard={showUpNext}
        activeItem="leaderboard"
        sticky={true}
      />

      <div className="max-w-6xl mx-auto px-6 lg:px-12">{children}</div>

      <Footer />
    </div>
  );
}
