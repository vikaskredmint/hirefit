import type { Database } from "@/integrations/supabase/types";

export type Tier = Database["public"]["Enums"]["match_tier"];
export type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];

export const TIER_LABEL: Record<Tier, string> = {
  strong_fit: "Strong Fit",
  good_fit: "Good Fit",
  possible_fit: "Possible Fit",
  not_fit: "Not a Fit",
};

export const TIER_CLASS: Record<Tier, string> = {
  strong_fit: "bg-tier-strong-bg text-tier-strong border-tier-strong/30",
  good_fit: "bg-tier-good-bg text-tier-good border-tier-good/30",
  possible_fit: "bg-tier-possible-bg text-tier-possible-foreground border-tier-possible/40",
  not_fit: "bg-tier-not-bg text-foreground/70 border-border",
};

export const TIER_RING: Record<Tier, string> = {
  strong_fit: "text-tier-strong",
  good_fit: "text-tier-good",
  possible_fit: "text-tier-possible",
  not_fit: "text-tier-not",
};

export const STAGES: PipelineStage[] = [
  "new",
  "reviewed",
  "shortlisted",
  "contacted",
  "interviewing",
  "offered",
  "rejected",
  "hired",
];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  reviewed: "Reviewed",
  shortlisted: "Shortlisted",
  contacted: "Contacted",
  interviewing: "Interviewing",
  offered: "Offered",
  rejected: "Rejected",
  hired: "Hired",
};

export function tierFromScore(score: number | null | undefined): Tier {
  if (score == null) return "not_fit";
  if (score >= 80) return "strong_fit";
  if (score >= 65) return "good_fit";
  if (score >= 45) return "possible_fit";
  return "not_fit";
}

export function formatInr(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
