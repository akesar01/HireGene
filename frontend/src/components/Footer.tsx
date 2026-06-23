import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-card-border bg-card-bg mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="SkipTheBoard" width={20} height={20} className="shrink-0" />
            <Link href="/" className="text-sm font-bold text-foreground tracking-tight">
              SkipTheBoard
            </Link>
            <span className="text-xs text-muted-light">
              &mdash; stalk the poster, not the board
            </span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-muted">
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/careers" className="hover:text-foreground transition-colors">
              Careers
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/submit" className="hover:text-foreground transition-colors">
              Submit
            </Link>
          </nav>
        </div>
        <p className="mt-4 text-center sm:text-left text-xs text-muted-light">
          &copy; {new Date().getFullYear()} SkipTheBoard. Real tech jobs from hiring managers, not job boards.
        </p>
      </div>
    </footer>
  );
}
