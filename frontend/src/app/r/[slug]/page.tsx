import Header from "@/components/Header";
import ResumeDisplay from "@/components/ResumeDisplay";
import { getPublicResume } from "@/lib/profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const profile = await getPublicResume(slug);
    const name = profile?.contact.name || "Resume";
    return {
      title: `${name} · Resume`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Resume", robots: { index: false, follow: false } };
  }
}

export default async function PublicResumePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let profile = null;
  try {
    profile = await getPublicResume(slug);
  } catch {
    profile = null;
  }

  return (
    <div className="min-h-screen">
      <Header maxWidth="max-w-3xl" />
      <div className="max-w-3xl mx-auto px-6 py-10">
        {!profile ? (
          <div className="text-center py-16">
            <h1 className="text-xl font-bold text-foreground">Resume not found</h1>
            <p className="text-sm text-muted mt-2">This link may have been removed.</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Resume</p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight mb-6">
              {profile.contact.name || profile.filterSummary.currentTitle || "Candidate"}
            </h1>
            <ResumeDisplay profile={profile} />
          </>
        )}
      </div>
    </div>
  );
}
