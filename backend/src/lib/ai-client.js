import { config } from "../config.js";

const endpoints = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  github: "https://models.github.ai/inference/chat/completions",
};

const providerHeaders = (provider, token) => {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://lovable.dev";
    headers["X-Title"] = "HireFit";
  }
  return headers;
};

const providers = () =>
  [
    config.ai.groqApiKey && { provider: "groq", token: config.ai.groqApiKey, model: config.ai.groqModel },
    config.ai.openRouterApiKey && {
      provider: "openrouter",
      token: config.ai.openRouterApiKey,
      model: config.ai.openRouterModel,
    },
    config.ai.githubToken && {
      provider: "github",
      token: config.ai.githubToken,
      model: config.ai.githubPrimaryModel,
    },
    config.ai.githubToken && {
      provider: "github",
      token: config.ai.githubToken,
      model: config.ai.githubFallbackModel,
    },
  ].filter(Boolean);

export class AiQuotaError extends Error {
  constructor(message, failures) {
    super(message);
    this.failures = failures;
    this.quota = true;
  }
}

const parseJson = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON");
    return JSON.parse(match[0]);
  }
};

export async function chatJson({ system, user }) {
  const chain = providers();
  if (!chain.length) throw new Error("No AI provider token configured. Set GITHUB_MODELS_TOKEN, GROQ_API_KEY, or OPENROUTER_API_KEY.");

  const failures = [];
  for (const item of chain) {
    const response = await fetch(endpoints[item.provider], {
      method: "POST",
      headers: providerHeaders(item.provider, item.token),
      body: JSON.stringify({
        model: item.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    }).catch((error) => ({ ok: false, status: 0, text: async () => error.message }));

    if (response.ok) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${item.provider} returned no message content`);
      return parseJson(content);
    }

    const body = await response.text().catch(() => "");
    failures.push({ provider: item.provider, model: item.model, status: response.status, body: body.slice(0, 300) });
    if (![0, 408, 409, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
  }

  const quotaOnly = failures.some((failure) => failure.status === 429);
  if (quotaOnly) throw new AiQuotaError("All configured AI providers hit quota/rate limits", failures);
  throw new Error(`AI scoring failed: ${failures.map((f) => `${f.provider}:${f.status}`).join(", ")}`);
}
