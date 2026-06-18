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
