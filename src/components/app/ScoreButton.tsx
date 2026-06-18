import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2 } from "lucide-react";
import { api, isBackendConfigured } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ScoreButton({ jobId, unscored }: { jobId: string; unscored: number }) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ scored: number; total: number } | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const start = async () => {
    if (!isBackendConfigured()) {
      toast.error("Scoring backend isn't connected yet. Set VITE_API_BASE_URL and redeploy.");
      return;
    }
    setRunning(true);
    try {
      await api.scoreJob(jobId);
      toast.success("Scoring queued");
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await api.scoringStatus(jobId);
          setStatus(s);
          qc.invalidateQueries({ queryKey: ["candidates", jobId] });
          qc.invalidateQueries({ queryKey: ["stats", jobId] });
          if (s.total > 0 && s.scored >= s.total) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setRunning(false);
            toast.success("All candidates scored");
          }
        } catch {
          /* keep polling */
        }
      }, 3000);
    } catch (e) {
      setRunning(false);
      toast.error((e as Error).message);
    }
  };

  const pct = status && status.total > 0 ? Math.round((status.scored / status.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={running || unscored === 0} className="h-11 w-full gap-2 sm:w-auto" size="lg">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {running ? "Scoring…" : unscored === 0 ? "All candidates scored" : `Score ${unscored} unscored candidate${unscored === 1 ? "" : "s"}`}
      </Button>
      {running && status && (
        <div className="space-y-1">
          <Progress value={pct} />
          <div className="text-xs text-muted-foreground">{status.scored} / {status.total} scored · this can take a few seconds per resume</div>
        </div>
      )}
    </div>
  );
}
