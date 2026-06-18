import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TierBadge } from "./TierBadge";
import { STAGES, STAGE_LABEL, TIER_LABEL, formatInr, type PipelineStage, type Tier } from "@/lib/tiers";
import { Search, MapPin, Briefcase, Clock, Mail, Inbox } from "lucide-react";
import { toast } from "sonner";

export type CandidateRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  current_location: string | null;
  current_company: string | null;
  current_designation: string | null;
  total_experience_years: number | null;
  annual_salary_inr: number | null;
  notice_period: string | null;
  resume_headline: string | null;
  pipeline_stage: PipelineStage;
  match_scores: { overall_score: number; tier: Tier } | null;
};

export function useCandidates(jobId: string) {
  return useQuery({
    queryKey: ["candidates", jobId],
    queryFn: async (): Promise<CandidateRow[]> => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id, name, email, phone, current_location, current_company, current_designation, total_experience_years, annual_salary_inr, notice_period, resume_headline, pipeline_stage, match_scores(overall_score, tier)",
        )
        .eq("job_id", jobId);
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        match_scores: Array.isArray(c.match_scores) ? (c.match_scores[0] ?? null) : (c.match_scores ?? null),
      })) as CandidateRow[];
    },
    enabled: !!jobId,
  });
}

const TIERS: Array<{ value: Tier | "all"; label: string }> = [
  { value: "all", label: "All tiers" },
  { value: "strong_fit", label: TIER_LABEL.strong_fit },
  { value: "good_fit", label: TIER_LABEL.good_fit },
  { value: "possible_fit", label: TIER_LABEL.possible_fit },
  { value: "not_fit", label: TIER_LABEL.not_fit },
];

export function CandidateList({
  jobId,
  onOpen,
}: {
  jobId: string;
  onOpen: (id: string) => void;
}) {
  const { data: rows = [], isLoading } = useCandidates(jobId);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [stage, setStage] = useState<PipelineStage | "all">("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const ms = Number(minScore) || 0;
    return [...rows]
      .filter((r) => {
        if (tier !== "all" && r.match_scores?.tier !== tier) return false;
        if (stage !== "all" && r.pipeline_stage !== stage) return false;
        if (ms > 0 && (r.match_scores?.overall_score ?? -1) < ms) return false;
        if (term) {
          const hay = `${r.name} ${r.current_company ?? ""} ${r.current_designation ?? ""}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.match_scores?.overall_score ?? -1) - (a.match_scores?.overall_score ?? -1));
  }, [rows, q, tier, stage, minScore]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const bulkEmail = () => {
    const emails = filtered.filter((r) => selected.has(r.id) && r.email).map((r) => r.email!);
    if (!emails.length) { toast.error("No email addresses in selection"); return; }
    const href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
    window.location.href = href;
    // log activity
    supabase.from("activity_log").insert(
      Array.from(selected).map((cid) => ({ candidate_id: cid, action: "email_sent" as const, notes: "Bulk email" })),
    ).then(({ error }) => { if (error) console.error(error); });
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or company" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={tier} onValueChange={(v) => setTier(v as Tier | "all")}>
            <SelectTrigger className="w-[10rem]"><SelectValue /></SelectTrigger>
            <SelectContent>{TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={stage} onValueChange={(v) => setStage(v as PipelineStage | "all")}>
            <SelectTrigger className="w-[10rem]"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger className="w-[8rem]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 50, 65, 75, 85].map((n) => <SelectItem key={n} value={String(n)}>Min {n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="flex items-center justify-between p-3">
          <div className="text-sm">{selected.size} selected</div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" onClick={bulkEmail} className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Email selected</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
      ) : filtered.length === 0 ? (
        <EmptyState hasRows={rows.length > 0} />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5"></th>
                  <th className="px-3 py-2.5 text-left">Name</th>
                  <th className="px-3 py-2.5 text-left">Score</th>
                  <th className="px-3 py-2.5 text-left">Tier</th>
                  <th className="px-3 py-2.5 text-left">Exp.</th>
                  <th className="px-3 py-2.5 text-left">Current co.</th>
                  <th className="px-3 py-2.5 text-left">Notice</th>
                  <th className="px-3 py-2.5 text-left">Location</th>
                  <th className="px-3 py-2.5 text-left">Stage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-t border-border/60 hover:bg-accent/40"
                    onClick={() => onOpen(r.id)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{r.current_designation ?? r.resume_headline ?? ""}</div>
                    </td>
                    <td className="px-3 py-3">
                      {r.match_scores ? (
                        <span className="font-semibold tabular-nums">{r.match_scores.overall_score}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{r.match_scores ? <TierBadge tier={r.match_scores.tier} /> : <span className="text-xs text-muted-foreground">Unscored</span>}</td>
                    <td className="px-3 py-3 tabular-nums">{r.total_experience_years ?? "—"}y</td>
                    <td className="px-3 py-3">{r.current_company ?? "—"}</td>
                    <td className="px-3 py-3">{r.notice_period ?? "—"}</td>
                    <td className="px-3 py-3">{r.current_location ?? "—"}</td>
                    <td className="px-3 py-3 text-xs">{STAGE_LABEL[r.pipeline_stage]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <Card key={r.id} className="cursor-pointer p-4 active:bg-accent/40" onClick={() => onOpen(r.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{r.name}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{r.current_designation ?? r.resume_headline ?? ""}</div>
                  </div>
                  <div className="text-right">
                    {r.match_scores ? (
                      <>
                        <div className="text-xl font-bold tabular-nums">{r.match_scores.overall_score}</div>
                        <TierBadge tier={r.match_scores.tier} className="mt-1" />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unscored</span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {r.current_company && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{r.current_company}</span>}
                  {r.current_location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.current_location}</span>}
                  {r.notice_period && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.notice_period}</span>}
                  {r.annual_salary_inr != null && <span>CTC {formatInr(r.annual_salary_inr)}</span>}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ hasRows }: { hasRows: boolean }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <div className="font-medium">{hasRows ? "No candidates match your filters" : "No candidates yet"}</div>
      <div className="text-sm text-muted-foreground">
        {hasRows ? "Try clearing the filters." : "Upload your Naukri export above to get started."}
      </div>
    </Card>
  );
}
