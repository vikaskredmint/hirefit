-- Run in Supabase SQL Editor if browser actions fail with:
-- "new row violates row-level security policy"

grant select, insert, update, delete on public.jobs to anon, authenticated;
grant select, insert, update, delete on public.candidates to anon, authenticated;
grant select, insert, update, delete on public.match_scores to anon, authenticated;
grant select, insert, update, delete on public.activity_log to anon, authenticated;

drop policy if exists "Auth users manage jobs" on public.jobs;
create policy "Auth users manage jobs" on public.jobs
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "Auth users manage candidates" on public.candidates;
create policy "Auth users manage candidates" on public.candidates
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "Auth users manage match_scores" on public.match_scores;
create policy "Auth users manage match_scores" on public.match_scores
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "Auth users manage activity_log" on public.activity_log;
create policy "Auth users manage activity_log" on public.activity_log
for all to anon, authenticated
using (true)
with check (true);
