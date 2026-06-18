import { supabase } from "../lib/supabase-client.js";
import { parseNaukriWorkbook } from "./xlsx-import.js";

export async function importCandidatesForJob({ job, file }) {
  const { rows, skipped } = await parseNaukriWorkbook(file.buffer, job.title);
  let imported = 0;
  let updated = 0;
  let ignored = skipped.empty + skipped.wrongJob;

  for (const row of rows) {
    if (!row.email) {
      ignored += 1;
      continue;
    }

    const { data: existing, error: findError } = await supabase
      .from("candidates")
      .select("id")
      .eq("job_id", job.id)
      .eq("email", row.email)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { error } = await supabase.from("candidates").update(row).eq("id", existing.id);
      if (error) throw error;
      updated += 1;
      continue;
    }

    const { error } = await supabase.from("candidates").insert({ ...row, job_id: job.id });
    if (error) throw error;
    imported += 1;
  }

  return { imported, updated, skipped: ignored };
}
