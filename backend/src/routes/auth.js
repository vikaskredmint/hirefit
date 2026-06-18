import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";

export const authRouter = Router();

const sign = (payload) => {
  const secret = config.backendSharedSecret || config.supabaseServiceRoleKey;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

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
    const expectedUser = config.admin.email.toLowerCase();
    if (!config.admin.password) throw new HttpError(500, "SUPER_ADMIN_PASSWORD is not configured");
    const validPasswords = new Set([config.admin.password, ...config.admin.passwordAliases]);

    if (userId !== expectedUser || !validPasswords.has(password)) {
      throw new HttpError(401, "Invalid user id or password");
    }

    const payload = Buffer.from(
      JSON.stringify({
        email: expectedUser,
        role: "super_admin",
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      }),
    ).toString("base64url");

    res.json({
      token: `${payload}.${sign(payload)}`,
      user: { email: expectedUser, role: "super_admin" },
    });
  }),
);
