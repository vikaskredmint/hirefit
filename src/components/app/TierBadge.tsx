import { cn } from "@/lib/utils";
import { TIER_CLASS, TIER_LABEL, type Tier } from "@/lib/tiers";

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TIER_CLASS[tier],
        className,
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
