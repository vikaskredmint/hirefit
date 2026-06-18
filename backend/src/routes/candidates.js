import { Router } from "express";
import multer from "multer";
import { supabase } from "../lib/supabase-client.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { importCandidatesForJob } from "../services/candidate-import.js";
import { extractResumeText, resumeFileKind } from "../services/pdf-extract.js";
import { uploadResumeFile } from "../lib/s3-client.js";
import { analyzeResumeText } from "../services/resume-analysis.js";

export const candidatesRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

const requireFile = (req) => {
  if (!req.file) throw new HttpError(400, "file is required");
  return req.file;
};

candidatesRouter.get(
  "/jobs/:id/candidates",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("candidates")
      .select(
        "id,name,email,phone,current_location,current_company,current_designation,total_experience_years,annual_salary_inr,notice_period,resume_headline,pipeline_stage,match_scores(overall_score,tier)",
      )
      .eq("job_id", req.params.id);
    if (error) throw error;
    res.json(data || []);
  }),
);

candidatesRouter.post(
  "/jobs/:id/candidates/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = requireFile(req);
    const { data: job, error } = await supabase.from("jobs").select("id,title").eq("id", req.params.id).single();
    if (error) throw new HttpError(404, "job not found");

    const result = await importCandidatesForJob({ job, file });
    res.json(result);
  }),
);

candidatesRouter.get(
  "/candidates/:id",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("candidates")
      .select("*, job:jobs(title), match_scores(*)")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data || null);
  }),
);

candidatesRouter.patch(
  "/candidates/:id",
  asyncHandler(async (req, res) => {
    const patch = {};
    if (req.body?.pipeline_stage) patch.pipeline_stage = req.body.pipeline_stage;
    if (!Object.keys(patch).length) throw new HttpError(400, "No supported fields to update");

    const { data, error } = await supabase
      .from("candidates")
      .update(patch)
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json(data);
  }),
);

candidatesRouter.get(
  "/candidates/:id/activity",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id,action,notes,actor,created_at")
      .eq("candidate_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  }),
);

candidatesRouter.post(
  "/candidates/:id/activity",
  asyncHandler(async (req, res) => {
    const action = String(req.body?.action || "");
    if (!action) throw new HttpError(400, "action is required");

    const { data, error } = await supabase
      .from("activity_log")
      .insert({
        candidate_id: req.params.id,
        action,
        notes: req.body?.notes ?? null,
        actor: req.user?.email ?? req.body?.actor ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);

candidatesRouter.post(
  "/candidates/:id/resume",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = requireFile(req);
    const kind = resumeFileKind(file);
    if (!kind) {
      throw new HttpError(400, "Only PDF, DOC, and DOCX resumes are supported");
    }

    const resumeText = await extractResumeText(file);
    const analysis = analyzeResumeText(resumeText);
    const { signedUrl, key } = await uploadResumeFile({ candidateId: req.params.id, file });
    const { data: existing, error: existingError } = await supabase
      .from("candidates")
      .select("screening_answers")
      .eq("id", req.params.id)
      .single();
    if (existingError) throw existingError;

    const { data, error } = await supabase
      .from("candidates")
      .update({
        resume_text: resumeText,
        resume_url: signedUrl,
        screening_answers: {
          ...(existing.screening_answers || {}),
          resume_storage_key: key,
          resume_file_type: kind,
          resume_analysis: analysis,
        },
      })
      .eq("id", req.params.id)
      .select("id,resume_url,resume_text")
      .single();
    if (error) throw error;

    res.json({ ...data, resume_analysis: analysis, resume_file_type: kind });
  }),
);
