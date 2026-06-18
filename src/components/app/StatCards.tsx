import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Sparkles, Trophy, MessageSquare, Activity } from "lucide-react";

export interface Stats {
  total: number;
  scored: number;
  strong: number;
  contacted: number;
  avg: number | null;
}

const ITEMS: Array<{ key: keyof Stats; label: string; Icon: typeof Users; tone: string }> = [
  { key: "total", label: "Candidates", Icon: Users, tone: "text-foreground" },
  { key: "scored", label: "Scored", Icon: Sparkles, tone: "text-primary" },
  { key: "strong", label: "Strong Fit", Icon: Trophy, tone: "text-tier-strong" },
  { key: "contacted", label: "Contacted", Icon: MessageSquare, tone: "text-tier-good" },
  { key: "avg", label: "Avg. score", Icon: Activity, tone: "text-tier-possible" },
];

export function StatCards({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ITEMS.map(({ key, label, Icon, tone }) => (
        <Card key={key} className="border-border/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Icon className={`h-3.5 w-3.5 ${tone}`} />
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {loading || !stats ? (
              <Skeleton className="h-7 w-12" />
            ) : key === "avg" ? (
              stats.avg == null ? "—" : Math.round(stats.avg)
            ) : (
              (stats[key] as number)
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
