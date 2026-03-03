export function Footer() {
  return (
    <footer className="border-t-[3px] border-black">
      <div className="max-w-6xl mx-auto px-6 py-6 text-center text-xs font-bold uppercase tracking-[0.3em] text-black/40">
        BROUGHT TO YOU BY{" "}
        <a
          href="https://fiveonefour.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-black/70 transition-colors"
        >
          FIVEONEFOUR
        </a>{" "}
        ·{" "}
        <a
          href="https://fiveonefour.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-black/70 transition-colors"
        >
          BECOME A SPONSOR
        </a>
      </div>
    </footer>
  );
}
