import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-[#fff5f0] via-background to-[#fff0eb]">
      <div className="w-full max-w-[400px]">
        {/* Branding */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.svg" alt="SkipTheBoard" width={28} height={28} className="shrink-0" />
          <span className="text-xl font-bold text-foreground tracking-tight">SkipTheBoard</span>
        </Link>

        <p className="text-center text-sm text-muted mb-6">
          Sign in to personalize your feed with resume matching
        </p>

        {/* Clerk card */}
        <div className="rounded-2xl bg-card-bg border border-card-border shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-2">
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none border-0 w-full",
                headerTitle: "text-foreground font-bold",
                headerSubtitle: "text-muted",
                socialButtonsBlockButton: "border border-card-border rounded-lg hover:bg-surface transition-colors",
                socialButtonsBlockButtonText: "text-foreground font-medium",
                dividerLine: "bg-card-border",
                dividerText: "text-muted text-xs",
                formFieldLabel: "text-foreground text-sm font-medium",
                formFieldInput: "border border-card-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors",
                formButtonPrimary: "bg-accent hover:bg-accent-hover rounded-lg text-sm font-semibold transition-colors",
                footerActionLink: "text-accent hover:text-accent-hover font-medium",
                identityPreviewText: "text-foreground",
                identityPreviewEditButton: "text-accent hover:text-accent-hover",
              },
            }}
          />
        </div>

        <p className="text-center text-xs text-muted-light mt-6">
          No account?{" "}
          <Link href="/sign-up" className="text-accent hover:text-accent-hover font-medium">
            Sign up
          </Link>
        </p>

        <p className="text-center text-xs text-muted-light mt-2">
          <Link href="/" className="hover:text-foreground transition-colors">
            &larr; back to feed
          </Link>
        </p>
      </div>
    </div>
  );
}
