
CREATE TYPE public.pipeline_stage AS ENUM ('new','reviewed','shortlisted','contacted','interviewing','offered','rejected','hired');
CREATE TYPE public.match_tier AS ENUM ('strong_fit','good_fit','possible_fit','not_fit');
CREATE TYPE public.activity_action AS ENUM ('called','sms_sent','email_sent','stage_changed','note');

CREATE TABLE public.allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read allow list" ON public.allowed_emails FOR SELECT TO authenticated USING (true);
INSERT INTO public.allowed_emails(email) VALUES ('vikas.raiexp@gmail.com');

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Email % is not authorized to sign in to HireFit', NEW.email;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_email_allowlist_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  jd_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage jobs" ON public.jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  current_location text,
  preferred_locations text,
  total_experience_years numeric,
  current_company text,
  current_designation text,
  annual_salary_inr numeric,
  notice_period text,
  resume_headline text,
  education_summary text,
  naukri_profile_url text,
  screening_answers jsonb,
  pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'new',
  resume_url text,
  resume_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidates_job_id_idx ON public.candidates(job_id);
CREATE INDEX candidates_stage_idx ON public.candidates(pipeline_stage);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage candidates" ON public.candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  tier public.match_tier NOT NULL,
  domain_match_score integer,
  experience_match_score integer,
  seniority_match_score integer,
  strengths text[] NOT NULL DEFAULT '{}',
  gaps text[] NOT NULL DEFAULT '{}',
  red_flags text[] NOT NULL DEFAULT '{}',
  ai_summary text,
  scored_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_scores_candidate_idx ON public.match_scores(candidate_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_scores TO authenticated;
GRANT ALL ON public.match_scores TO service_role;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage match_scores" ON public.match_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  action public.activity_action NOT NULL,
  notes text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_candidate_idx ON public.activity_log(candidate_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage activity_log" ON public.activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
