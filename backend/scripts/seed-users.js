/**
 * Seed default recruiter accounts.
 * Run: node backend/scripts/seed-users.js
 * Uses .env from repo root.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

const SEED_USERS = [
  {
    email: "mayank.chawla@kredmint.com",
    name: "Mayank Chawla",
    password: "Kredmint@123",
    role: "recruiter",
  },
  {
    email: "vikas.rai@kredmint.com",
    name: "Vikas Rai",
    password: "Kredmint@123",
    role: "recruiter",
  },
];

console.log("🌱  Seeding users into allowed_emails...\n");

for (const user of SEED_USERS) {
  const { data, error } = await supabase
    .from("allowed_emails")
    .upsert(
      {
        email: user.email,
        name: user.name,
        password_hash: hashPassword(user.password),
        role: user.role,
        is_active: true,
      },
      { onConflict: "email" }
    )
    .select("email, role, created_at")
    .single();

  if (error) {
    console.error(`❌  Failed to seed ${user.email}:`, error.message);
  } else {
    console.log(`✅  Seeded: ${data.email}  (role: ${data.role})`);
  }
}

console.log("\n✅  Done! Users can now log in at /auth with the passwords provided.");
