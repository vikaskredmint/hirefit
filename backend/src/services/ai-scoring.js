import { supabase } from "../lib/supabase-client.js";
import { chatJson } from "../lib/ai-client.js";

const rubric = `Return only valid JSON matching the required schema.

Scoring rubric, weights matter:
- Domain fit (30%) — BFSI, FinTech, Consumer products, Travel, Rewards, Loyalty, Customer Engagement, or Employee Benefits experience
- Enterprise SaaS solution-selling evidence (25%) — proven solution selling to large enterprise clients, not SMB/transactional sales
- Seniority & stakeholder engagement (15%) — evidence of engaging CXOs, business heads, marketing leaders, HR leaders, or procurement
- Experience-band fit (15%) — JD wants 10–12 years; score full marks at 10-12, partial credit down to 7 and up to 15, low below/above that
- Track record vs. targets (15%) — quota attainment, revenue growth %, named wins

Required JSON schema:
{
  "overall_score": 0-100,
  "tier": "strong_fit | good_fit | possible_fit | not_fit",
  "domain_match_score": 0-100,
  "experience_match_score": 0-100,
  "seniority_match_score": 0-100,
  "strengths": ["short bullet", "..."],
  "gaps": ["short bullet", "..."],
  "red_flags": ["short bullet", "..."],
  "ai_summary": "2-3 sentence overall take"
}

Tier thresholds: 80-100 strong_fit, 60-79 good_fit, 40-59 possible_fit, below 40 not_fit.`;

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const tierFor = (score) => {
  if (score >= 80) return "strong_fit";
  if (score >= 60) return "good_fit";
  if (score >= 40) return "possible_fit";
  return "not_fit";
};

const normalizeArray = (value) =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [];

const candidatePayload = (candidate) =>
  JSON.stringify(
    {
      name: candidate.name,
      email: candidate.email,
      experience_years: candidate.total_experience_years,
      current_company: candidate.current_company,
      current_designation: candidate.current_designation,
      salary_inr: candidate.annual_salary_inr,
      notice_period: candidate.notice_period,
      location: candidate.current_location,
      preferred_locations: candidate.preferred_locations,
      education: candidate.education_summary,
      resume_headline: candidate.resume_headline,
      screening_answers: candidate.screening_answers,
      resume_text: candidate.resume_text || "",
    },
    null,
    2,
  );

export async function scoreCandidate({ candidateId }) {
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*, jobs!inner(id,title,jd_text)")
    .eq("id", candidateId)
    .single();
  if (candidateError) throw candidateError;

  const result = await chatJson({
    system: `Job title: ${candidate.jobs.title}\n\nJob description:\n${candidate.jobs.jd_text}\n\n${rubric}`,
    user: `Candidate data:\n${candidatePayload(candidate)}`,
  });

  const overall = clampScore(result.overall_score);
  const row = {
    candidate_id: candidate.id,
    overall_score: overall,
    tier: ["strong_fit", "good_fit", "possible_fit", "not_fit"].includes(result.tier) ? result.tier : tierFor(overall),
    domain_match_score: clampScore(result.domain_match_score),
    experience_match_score: clampScore(result.experience_match_score),
    seniority_match_score: clampScore(result.seniority_match_score),
    strengths: normalizeArray(result.strengths),
    gaps: normalizeArray(result.gaps),
    red_flags: normalizeArray(result.red_flags),
    ai_summary: result.ai_summary ? String(result.ai_summary).slice(0, 1200) : null,
    scored_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("match_scores").upsert(row, { onConflict: "candidate_id" }).select().single();
  if (error) throw error;
  return data;
}
