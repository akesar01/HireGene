interface SocialProofProps {
  totalJobs: number;
  totalCompanies: number;
  totalManagers: number;
}

export default function SocialProof({
  totalJobs,
  totalCompanies,
  totalManagers,
}: SocialProofProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-foreground">{totalJobs}</span>
        live jobs
      </span>

      <span className="text-muted-light">·</span>

      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-foreground">{totalCompanies}</span>
        companies hiring
      </span>

      <span className="text-muted-light">·</span>

      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-foreground">{totalManagers}</span>
        hiring managers tracked
      </span>
    </div>
  );
}
