import "dotenv/config";
import { config } from "../src/config.js";
import { supabase } from "../src/lib/supabase-client.js";

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const hit = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

async function main() {
  if (!config.admin.password) throw new Error("SUPER_ADMIN_PASSWORD is required");

  const email = config.admin.email.toLowerCase();
  const { error: allowError } = await supabase.from("allowed_emails").upsert({ email }, { onConflict: "email" });
  if (allowError) throw allowError;

  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password: config.admin.password,
      email_confirm: true,
      user_metadata: { role: "super_admin" },
    });
    if (error) throw error;
    console.log(`Updated super admin: ${email}`);
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password: config.admin.password,
    email_confirm: true,
    user_metadata: { role: "super_admin" },
  });
  if (error) throw error;
  console.log(`Created super admin: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
