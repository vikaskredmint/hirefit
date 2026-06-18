import { Router } from "express";
import crypto from "node:crypto";
import { supabase } from "../lib/supabase-client.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { config } from "../config.js";
import { sign, hashPassword } from "./auth.js";

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
    const { data: dbUsers, error } = await supabase
      .from("allowed_emails")
      .select("email,role,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const allUsers = [...(dbUsers || [])].map(u => ({
      email: u.email,
      role: u.role,
      createdAt: u.created_at
    }));

    // Ensure the default env admin is included if not already in the database
    if (!allUsers.some(u => u.email.toLowerCase() === config.admin.email.toLowerCase())) {
      allUsers.unshift({
        email: config.admin.email,
        role: "super_admin",
        createdAt: null,
      });
    }
    res.json(allUsers);
  }),
);

adminRouter.post(
  "/admin/users",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "recruiter").trim();

    if (!email || !password) throw new HttpError(400, "Email and password required");
    if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");

    // Do not allow creating/overwriting default super admin email from env
    if (email === config.admin.email.trim().toLowerCase()) {
      throw new HttpError(400, "Email matches the default environment Super Admin. You cannot overwrite it here.");
    }

    const { data, error } = await supabase
      .from("allowed_emails")
      .upsert({
        email,
        password_hash: hashPassword(password),
        role
      }, { onConflict: "email" })
      .select("email,role,created_at")
      .single();

    if (error) throw error;

    res.status(201).json({
      email: data.email,
      role: data.role,
      createdAt: data.created_at,
      message: "User created successfully. They can now log in with their email and password."
    });
  }),
);

adminRouter.post(
  "/admin/users/:email/reset-password",
  asyncHandler(async (req, res) => {
    const email = req.params.email.trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!password || password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters");
    }

    // Do not allow resetting the default env super admin via DB
    if (email === config.admin.email.trim().toLowerCase()) {
      throw new HttpError(400, "Default Super Admin password is set via environment variables and cannot be reset here.");
    }

    const { error } = await supabase
      .from("allowed_emails")
      .update({ password_hash: hashPassword(password) })
      .eq("email", email);

    if (error) throw error;

    res.json({ success: true, message: `Password for ${email} has been reset.` });
  }),
);

adminRouter.delete(
  "/admin/users/:email",
  asyncHandler(async (req, res) => {
    const email = req.params.email.trim().toLowerCase();
    
    if (email === config.admin.email.trim().toLowerCase()) {
      throw new HttpError(400, "Cannot delete the default Super Admin user.");
    }

    const { error } = await supabase
      .from("allowed_emails")
      .delete()
      .eq("email", email);

    if (error) throw error;

    res.json({ deleted: true });
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
