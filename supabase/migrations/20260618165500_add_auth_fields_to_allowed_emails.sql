-- Add password_hash and role to allowed_emails
alter table public.allowed_emails add column if not exists password_hash text;
alter table public.allowed_emails add column if not exists role text not null default 'recruiter';
