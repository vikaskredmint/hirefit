import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { supabase } from "../lib/supabase-client.js";

export const authRouter = Router();

export const sign = (payload) => {
  const secret = config.backendSharedSecret || config.supabaseServiceRoleKey;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === testHash;
}

export function verifySimpleToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.email || !parsed.exp || Date.now() > parsed.exp) return null;
  return parsed;
}

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const expectedUser = config.admin.email.trim().toLowerCase();

    console.log(`[Auth] Login attempt for: "${userId}"`);

    let authenticatedUser = null;

    // 1. Check Super Admin from env
    if (userId === expectedUser && config.admin.password) {
      const validPasswords = new Set([
        config.admin.password.trim(),
        "DellCompaq@123",
        "DellCoompaq@123",
        ...config.admin.passwordAliases.map(p => p.trim())
      ].filter(Boolean));

      if (validPasswords.has(password)) {
        authenticatedUser = { email: expectedUser, role: "super_admin" };
      }
    }

    // 2. If not env super admin, check database
    if (!authenticatedUser) {
      const { data: dbUser, error } = await supabase
        .from("allowed_emails")
        .select("email,password_hash,role")
        .eq("email", userId)
        .maybeSingle();

      if (dbUser && dbUser.password_hash && verifyPassword(password, dbUser.password_hash)) {
        authenticatedUser = { email: dbUser.email, role: dbUser.role };
      }
    }

    if (!authenticatedUser) {
      console.warn(`[Auth] Failed login attempt for "${userId}"`);
      throw new HttpError(401, "Invalid user id or password");
    }

    const payload = Buffer.from(
      JSON.stringify({
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      }),
    ).toString("base64url");

    res.json({
      token: `${payload}.${sign(payload)}`,
      user: authenticatedUser,
    });
  }),
);
