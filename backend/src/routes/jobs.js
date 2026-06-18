import { Router } from "express";
import { supabase } from "../lib/supabase-client.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";

export const jobsRouter = Router();

jobsRouter.post(
  "/jobs",
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const jdText = String(req.body?.jd_text || "").trim();
    if (!title) throw new HttpError(400, "title is required");

    const { data, error } = await supabase
      .from("jobs")
      .insert({ title, jd_text: jdText })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);
