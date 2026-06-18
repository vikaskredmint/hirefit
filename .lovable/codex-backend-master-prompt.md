# MASTER PROMPT — Paste this into Codex

## Build the "HireFit" backend: candidate import, resume parsing, and AI fit-scoring

This is the backend half of a recruiter triage tool (frontend already being built separately in Lovable, on Supabase). Your job: a standalone Node.js service that imports candidates from a Naukri Excel export, extracts text from resume PDFs, and scores each candidate against a job description using **GitHub Models' free inference API** — no paid AI APIs, no telephony APIs, no SMS-sending services.

Write this as its own repo/folder, separate from any frontend code.

## 1. Stack
- Node.js + Express (or Fastify)
- Postgres = the **same Supabase project** the frontend uses — connect via the Supabase service-role key so this service can read/write the `jobs`, `candidates`, `match_scores`, `activity_log` tables the frontend already created. Don't create a second database.
- Supabase Storage for resume PDFs (private bucket), accessed through the S3-compatible endpoint with `@aws-sdk/client-s3`.
- S3-compatible storage config:
  - `S3_ENDPOINT=https://hwrckmdtcdvpxtpwtsrj.storage.supabase.co/storage/v1/s3`
  - `S3_REGION=ap-southeast-2`
  - `S3_ACCESS_KEY_ID=e4502801fabaca9da92eed81bc9b7301`
  - `S3_SECRET_ACCESS_KEY` must come from the runtime environment; don't hardcode it in source or committed docs.
  - Use path-style addressing for the Supabase S3 endpoint.
  - Upload into a private resume bucket, default `S3_RESUME_BUCKET=resumes` unless the existing Supabase project already uses a different private bucket name.
- Redis + BullMQ for the scoring queue — reuse the same pattern from the JustNow pipeline (job queue + worker, not synchronous scoring in the request handler).
- `xlsx` (SheetJS) or `exceljs` for Excel parsing.
- `pdf-parse` for resume text extraction.

## 2. Endpoints

```
POST /api/jobs                          body: { title, jd_text }
POST /api/jobs/:id/candidates/import    multipart: xlsx file
POST /api/candidates/:id/resume         multipart: pdf file
POST /api/jobs/:id/score                body: {} (optional: { force: true } to rescore everyone)
GET  /api/jobs/:id/scoring-status       -> { scored: number, total: number }
```

## 3. Excel import — exact column mapping

The Naukri export has these columns (confirmed from a real export — map exactly, don't guess at alternate names):

| Excel column | Maps to |
|---|---|
| Name | candidates.name |
| Email ID | candidates.email *(can contain multiple comma-separated addresses — store the first as primary, keep the full string too)* |
| Phone Number | candidates.phone |
| Current Location | candidates.current_location |
| Preferred Locations | candidates.preferred_locations |
| Total Experience | parse "9 Year(s) 0 Month(s)" → decimal years (9.0), store as candidates.total_experience_years |
| Curr. Company name | candidates.current_company |
| Curr. Company Designation | candidates.current_designation |
| Annual Salary | parse "Rs 18 Lakhs" → 1800000, store as candidates.annual_salary_inr |
| Notice period/ Availability to join | candidates.notice_period |
| Resume Headline | candidates.resume_headline |
| Under Graduation degree / UG University / PG specialization / PG university | concatenate into candidates.education_summary |
| Candidate profile (the "View profile" cell) | **the visible text is just "View profile" — the real URL is a hyperlink on the cell, not the cell value.** With `exceljs` read `cell.hyperlink`; with SheetJS check `cell.l.Target`. Store that as candidates.naukri_profile_url. This is the single easiest field to get wrong — test it explicitly. |
| Any column matching `Ans(...)` | these are the screening questions set per job posting and **will differ between job posts** — don't hardcode them. Collect every `Ans(...)` column dynamically into a single `screening_answers` jsonb object keyed by the question text inside the parentheses. |

Skip rows where the row's "Job Title" doesn't match the job being imported into (the export can contain multiple job postings if downloaded in bulk). Import is idempotent — match existing candidates by job_id + email before inserting, so re-uploading the same export doesn't create duplicates.

## 4. Resume PDF handling
- Extract raw text with `pdf-parse`, store full text on `candidates.resume_text`.
- Upload the original PDF to Supabase Storage through the S3-compatible endpoint above, store the storage key plus a signed URL on `candidates.resume_url`.
- Generate signed resume URLs server-side; don't make the resume bucket public.
- No structured parsing step needed beyond raw text — the scoring prompt below does extraction and evaluation in one AI call rather than two, to stay inside the free rate limit.

## 5. AI scoring — GitHub Models integration

**Endpoint:** `POST https://models.github.ai/inference/chat/completions`
**Auth:** `Authorization: Bearer ${GITHUB_MODELS_TOKEN}` — a GitHub PAT with `models:read` scope, OpenAI-compatible request/response shape.
**Primary model:** `openai/gpt-4o-mini`. **Fallback model on 429:** `meta/llama-3.3-70b-instruct`.

The free tier is roughly 10–15 requests/minute and 50–150 requests/day *per model*, which will not get through 61 candidates in one run reliably. Reuse the exact Groq → OpenRouter → GitHub Models fallback chain already built for the JustNow content pipeline rather than writing a new one — same retry/backoff logic, just pointed at this scoring prompt instead of article summarization. Queue scoring jobs through BullMQ with concurrency 1 and a fixed delay (~4-5s) between calls so the daily/minute caps aren't hit; surface remaining quota errors back to `scoring-status` rather than failing the whole batch.

**Request shape** — one BullMQ job per candidate:
- System message: the job's `jd_text`, plus this rubric, plus an instruction to return **only** valid JSON matching the schema below (use `response_format: { type: "json_object" }`).
- User message: candidate's structured fields (experience, current company/designation, salary, notice period, education) + full `resume_text`.

**Scoring rubric (bake into the system prompt verbatim, weights matter):**
- Domain fit (30%) — BFSI, FinTech, Consumer products, Travel, Rewards, Loyalty, Customer Engagement, or Employee Benefits experience
- Enterprise SaaS solution-selling evidence (25%) — proven solution selling to large enterprise clients, not SMB/transactional sales
- Seniority & stakeholder engagement (15%) — evidence of engaging CXOs, business heads, marketing leaders, HR leaders, or procurement
- Experience-band fit (15%) — JD wants 10–12 years; score full marks at 10-12, partial credit down to 7 and up to 15, low below/above that
- Track record vs. targets (15%) — quota attainment, revenue growth %, named wins

**Required JSON response schema:**
```json
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
```
Tier thresholds: 80-100 strong_fit, 60-79 good_fit, 40-59 possible_fit, below 40 not_fit. Write the result straight into `match_scores`, one row per candidate, upsert on candidate_id.

`POST /api/jobs/:id/score` enqueues one job per candidate without a `match_scores` row yet (or every candidate if `force: true`). `GET /api/jobs/:id/scoring-status` returns counts so the frontend can poll.

## 6. What NOT to build
- No calling/SMS-sending integration (Twilio, etc.) — the frontend handles outreach via `tel:`/`sms:`/`mailto:` links, this backend never touches a phone number for anything but storage.
- No separate auth system — trust requests carrying a valid Supabase service-role key internally; the frontend's Supabase Auth already gates the humans.
- No second database — this service and the Lovable frontend share one Supabase Postgres instance.

## 7. File structure
```
/src
  /routes        jobs.js, candidates.js, scoring.js
  /services      xlsx-import.js, pdf-extract.js, ai-scoring.js
  /queues        scoring-queue.js, scoring-worker.js
  /lib           supabase-client.js, github-models-client.js
  server.js
```

## 8. Deliverables checklist for this session
- [ ] Working `/candidates/import` that correctly extracts the hyperlinked Naukri URL, not just "View profile" text
- [ ] Dynamic `Ans(...)` column handling tested against a sample export with different screening questions
- [ ] Scoring worker respects rate limits and falls back across providers instead of dying on first 429
- [ ] `scoring-status` accurately reflects in-progress batches so the frontend progress bar isn't a lie
