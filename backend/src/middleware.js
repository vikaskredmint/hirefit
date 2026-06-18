import { config } from "./config.js";
import { HttpError } from "./lib/http-error.js";

export function requireInternalAuth(req, _res, next) {
  if (!config.backendSharedSecret) return next();

  const header = req.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const apiKey = req.get("x-backend-secret") || req.get("x-service-role-key") || bearer;

  if (apiKey === config.backendSharedSecret || apiKey === config.supabaseServiceRoleKey) {
    return next();
  }

  return next(new HttpError(401, "Missing or invalid backend service key"));
}
