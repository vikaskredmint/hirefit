import { TIER_RING, tierFromScore, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export function ScoreRing({
  score,
  tier,
  size = 88,
  stroke = 8,
}: {
  score: number | null;
  tier?: Tier;
  size?: number;
  stroke?: number;
}) {
  const t = tier ?? tierFromScore(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className={cn("transition-all duration-500", TIER_RING[t])}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{score ?? "—"}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">score</span>
      </div>
    </div>
  );
}
