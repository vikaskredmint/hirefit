import { Router } from "express";
import crypto from "node:crypto";
import { supabase } from "../lib/supabase-client.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { config } from "../config.js";
import { sign } from "./auth.js";

export const adminRouter = Router();

// ── Middleware: require admin token ─────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new HttpError(401, "Unauthorized");

  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new HttpError(401, "Bad token");

  const secret = config.backendSharedSecret || config.supabaseServiceRoleKey;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (signature.length !== expected.length) throw new HttpError(401, "Bad token");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new HttpError(401, "Bad token");

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.email || !parsed.exp || Date.now() > parsed.exp) throw new HttpError(401, "Token expired");
  if (parsed.role !== "super_admin") throw new HttpError(403, "Forbidden");

  req.adminUser = parsed;
  next();
}

// Apply to all admin routes
adminRouter.use(asyncHandler(requireAdmin));

// ── JOBS ─────────────────────────────────────────────────────────────────────

adminRouter.get(
  "/admin/jobs",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,jd_text,created_at,is_active")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  }),
);

adminRouter.patch(
  "/admin/jobs/:id/disable",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("jobs")
      .update({ is_active: false })
      .eq("id", req.params.id)
      .select("id,title,is_active")
      .single();
    if (error) throw error;
    res.json(data);
  }),
);

adminRouter.patch(
  "/admin/jobs/:id/enable",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("jobs")
      .update({ is_active: true })
      .eq("id", req.params.id)
      .select("id,title,is_active")
      .single();
    if (error) throw error;
    res.json(data);
  }),
);

adminRouter.delete(
  "/admin/jobs/:id",
  asyncHandler(async (req, res) => {
    // Delete candidates first (cascading)
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id")
      .eq("job_id", req.params.id);

    if (candidates?.length) {
      const ids = candidates.map((c) => c.id);
      await supabase.from("activity_log").delete().in("candidate_id", ids);
      await supabase.from("match_scores").delete().in("candidate_id", ids);
      await supabase.from("candidates").delete().in("id", ids);
    }

    const { error } = await supabase.from("jobs").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ deleted: true });
  }),
);

// ── CANDIDATES ───────────────────────────────────────────────────────────────

adminRouter.get(
  "/admin/candidates",
  asyncHandler(async (req, res) => {
    const jobId = req.query.jobId;
    let query = supabase
      .from("candidates")
      .select("id,name,email,phone,current_location,current_company,current_designation,pipeline_stage,job_id,created_at,match_scores(overall_score,tier)")
      .order("created_at", { ascending: false });
    if (jobId) query = query.eq("job_id", jobId);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  }),
);

adminRouter.delete(
  "/admin/candidates/:id",
  asyncHandler(async (req, res) => {
    await supabase.from("activity_log").delete().eq("candidate_id", req.params.id);
    await supabase.from("match_scores").delete().eq("candidate_id", req.params.id);
    const { error } = await supabase.from("candidates").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ deleted: true });
  }),
);

adminRouter.patch(
  "/admin/candidates/:id/stage",
  asyncHandler(async (req, res) => {
    const stage = String(req.body?.pipeline_stage || "").trim();
    if (!stage) throw new HttpError(400, "pipeline_stage required");
    const { data, error } = await supabase
      .from("candidates")
      .update({ pipeline_stage: stage })
      .eq("id", req.params.id)
      .select("id,name,pipeline_stage")
      .single();
    if (error) throw error;
    res.json(data);
  }),
);

// ── USERS ────────────────────────────────────────────────────────────────────

adminRouter.get(
  "/admin/users",
  asyncHandler(async (_req, res) => {
    // Return the single configured admin user
    res.json([
      {
        email: config.admin.email,
        role: "super_admin",
        createdAt: null,
      },
    ]);
  }),
);

adminRouter.post(
  "/admin/users",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "recruiter").trim();

    if (!email || !password) throw new HttpError(400, "email and password required");
    if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");

    // For the single-admin setup, generate a scoped token for new user
    const payload = Buffer.from(
      JSON.stringify({
        email,
        role,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
        tempPassword: password,
      }),
    ).toString("base64url");

    const token = `${payload}.${sign(payload)}`;

    res.status(201).json({
      email,
      role,
      token,
      message: "User credentials generated. Share the token or set up proper auth.",
    });
  }),
);

// ── STATS ────────────────────────────────────────────────────────────────────

adminRouter.get(
  "/admin/stats",
  asyncHandler(async (_req, res) => {
    const [jobsRes, candidatesRes] = await Promise.all([
      supabase.from("jobs").select("id,is_active", { count: "exact" }),
      supabase.from("candidates").select("id,pipeline_stage", { count: "exact" }),
    ]);

    const jobs = jobsRes.data || [];
    const candidates = candidatesRes.data || [];

    res.json({
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.is_active !== false).length,
      totalCandidates: candidates.length,
      hired: candidates.filter((c) => c.pipeline_stage === "hired").length,
      interviewing: candidates.filter((c) => c.pipeline_stage === "interviewing").length,
    });
  }),
);
