import { Router } from "express";
import { supabase } from "../lib/supabase-client.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { enqueueCandidateScore, getScoringQueue, queueCounts } from "../queues/scoring-queue.js";
import { scoreCandidate } from "../services/ai-scoring.js";

export const scoringRouter = Router();

const candidatesForScoring = async (jobId, force) => {
  let query = supabase.from("candidates").select("id,match_scores(id)").eq("job_id", jobId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).filter((candidate) => {
    const score = candidate.match_scores;
    const hasScore = Array.isArray(score) ? score.length > 0 : Boolean(score);
    return force || !hasScore;
  });
};

scoringRouter.post(
  "/jobs/:id/score",
  asyncHandler(async (req, res) => {
    try {
      const { data: job, error } = await supabase.from("jobs").select("id").eq("id", req.params.id).single();
      if (error) throw new HttpError(404, "job not found");

      const force = Boolean(req.body?.force);
      const candidates = await candidatesForScoring(job.id, force);

      try {
        await Promise.all(
          candidates.map((candidate, index) =>
            enqueueCandidateScore(candidate.id, index).catch((e) => {
              // Fail fast with context; otherwise Promise.all hides which enqueue failed.
              throw e;
            }),
          ),
        );
      } catch (enqueueErr) {
        const msg = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr);
        throw new HttpError(500, `Failed to enqueue scoring jobs: ${msg}`);
      }

      res.json({ queued: candidates.length });
    } catch (err) {
      // Preserve HttpError status; attach safe details for debugging.
      if (err?.status || err?.statusCode) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpError(500, "Failed to start scoring", { detail: msg });
    }
  }),
);

scoringRouter.get(

  "/jobs/:id/scoring-status",
  asyncHandler(async (req, res) => {
    const [{ count: total, error: totalError }, { count: scored, error: scoredError }, counts, failedJobs] =
      await Promise.all([
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("job_id", req.params.id),
        supabase
          .from("match_scores")
          .select("candidate_id,candidates!inner(job_id)", { count: "exact", head: true })
          .eq("candidates.job_id", req.params.id),
        queueCounts(),
        getScoringQueue().getFailed(0, 5),
      ]);
    if (totalError) throw totalError;
    if (scoredError) throw scoredError;

    res.json({
      scored: scored || 0,
      total: total || 0,
      queued: (counts.waiting || 0) + (counts.delayed || 0),
      active: counts.active || 0,
      failed: counts.failed || 0,
      recent_errors: failedJobs.map((job) => ({
        candidate_id: job.data?.candidateId,
        reason: job.failedReason,
      })),
    });
  }),
);

scoringRouter.post(
  "/candidates/:id/score",
  asyncHandler(async (req, res) => {
    const candidateId = req.params.id;
    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("id")
      .eq("id", candidateId)
      .maybeSingle();

    if (error) throw error;
    if (!candidate) throw new HttpError(404, "Candidate not found");

    const result = await scoreCandidate({ candidateId });
    res.json(result);
  }),
);

