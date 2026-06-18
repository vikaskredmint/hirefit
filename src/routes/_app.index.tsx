import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { JobSelector } from "@/components/app/JobSelector";
import { StatCards, type Stats } from "@/components/app/StatCards";
import { UploadZones } from "@/components/app/UploadZones";
import { ScoreButton } from "@/components/app/ScoreButton";
import { CandidateList } from "@/components/app/CandidateList";
import { CandidateDetail } from "@/components/app/CandidateDetail";
import { Card } from "@/components/ui/card";
import { api, isBackendConfigured } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "HireFit — Kredmint candidate triage" },
      { name: "description", content: "AI-ranked candidates for your open roles. Call, SMS, and email the strong fits in one tap." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [jobId, setJobId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("hf:jobId") : null,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  // Auto-pick the first job if nothing selected
  const { data: firstJob } = useQuery({
    queryKey: ["jobs", "first"],
    queryFn: async () => {
      const jobs = await api.listJobs();
      return jobs[0]?.id ?? null;
    },
  });
  useEffect(() => {
    if (!jobId && firstJob) setJobId(firstJob);
  }, [jobId, firstJob]);
  useEffect(() => {
    if (jobId) localStorage.setItem("hf:jobId", jobId);
  }, [jobId]);

  const { data: stats } = useQuery({
    queryKey: ["stats", jobId],
    queryFn: async (): Promise<Stats> => {
      if (!jobId) return { total: 0, scored: 0, strong: 0, contacted: 0, avg: null };
      const rows = await api.listCandidates(jobId);
      const scores = rows
        .map((r) => (Array.isArray(r.match_scores) ? r.match_scores[0] : r.match_scores))
        .filter((s): s is { overall_score: number; tier: string } => !!s);
      const total = rows.length;
      const scored = scores.length;
      const strong = scores.filter((s) => s.tier === "strong_fit").length;
      const contacted = rows.filter((r) => ["contacted", "interviewing", "offered", "hired"].includes(r.pipeline_stage as string)).length;
      const avg = scored ? scores.reduce((a, s) => a + s.overall_score, 0) / scored : null;
      return { total, scored, strong, contacted, avg };
    },
    enabled: !!jobId,
  });

  const unscored = useMemo(() => (stats ? stats.total - stats.scored : 0), [stats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidate triage</h1>
          <p className="text-sm text-muted-foreground">Upload, score, and reach out — all in one place.</p>
        </div>
        <JobSelector selectedId={jobId} onSelect={setJobId} />
      </div>

      {!isBackendConfigured() && (
        <Card className="flex items-start gap-3 border-tier-possible/40 bg-tier-possible-bg/40 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-tier-possible-foreground" />
          <div>
            <div className="font-medium">Scoring backend not connected yet</div>
            <div className="text-muted-foreground">
              You can create jobs, update stages, log activity and email candidates today. Excel import, resume upload and AI scoring will start working as soon as <code className="rounded bg-background px-1">VITE_API_BASE_URL</code> points at the Node service.
            </div>
          </div>
        </Card>
      )}

      {!jobId ? (
        <Card className="p-10 text-center">
          <h2 className="text-lg font-medium">Create your first job</h2>
          <p className="mt-1 text-sm text-muted-foreground">Click "New job" above to paste a JD and start triaging.</p>
        </Card>
      ) : (
        <>
          <StatCards stats={stats ?? null} loading={!stats} />
          <UploadZones jobId={jobId} />
          <ScoreButton jobId={jobId} unscored={unscored} />
          <CandidateList jobId={jobId} onOpen={setOpenId} />
        </>
      )}

      <CandidateDetail candidateId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
