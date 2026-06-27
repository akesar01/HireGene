interface MatchBadgeProps {
  score: number;
  reason?: string;
}

export default function MatchBadge({ score, reason }: MatchBadgeProps) {
  let colorClass: string;
  if (score >= 70) {
    colorClass = "bg-green-500/15 text-green-700 border-green-500/30";
  } else if (score >= 40) {
    colorClass = "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
  } else {
    colorClass = "bg-surface text-muted border-card-border";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${colorClass}`}
      title={reason}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {score}% match
    </span>
  );
}
