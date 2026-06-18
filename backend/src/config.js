import "dotenv/config";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

export const config = {
  port: Number(process.env.BACKEND_PORT || process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  backendSharedSecret: process.env.BACKEND_SHARED_SECRET || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  s3: {
    endpoint: required("S3_ENDPOINT"),
    region: process.env.S3_REGION || "ap-southeast-2",
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    bucket: process.env.S3_RESUME_BUCKET || process.env.S3_BUCKET || "resumes",
  },
  ai: {
    githubToken: process.env.GITHUB_MODELS_TOKEN || "",
    githubPrimaryModel: process.env.GITHUB_MODELS_PRIMARY_MODEL || "openai/gpt-4o-mini",
    githubFallbackModel: process.env.GITHUB_MODELS_FALLBACK_MODEL || "meta/llama-3.3-70b-instruct",
    groqApiKey: process.env.GROQ_API_KEY || "",
    groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openRouterModel: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
  },
  admin: {
    email: process.env.SUPER_ADMIN_EMAIL || "vikas.raiexp@gmail.com",
    password: process.env.SUPER_ADMIN_PASSWORD || "",
    passwordAliases: (process.env.SUPER_ADMIN_PASSWORD_ALIASES || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  },
};
