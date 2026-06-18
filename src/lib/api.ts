// Thin client for the separate Node.js backend (XLSX/PDF/AI scoring).
// Set VITE_API_BASE_URL in .env when the backend is live. Until then,
// these helpers throw a friendly error and the UI surfaces it as a toast.

const getApiBaseUrl = () => {
  const envBase = (import.meta.env.VITE_API_BASE_URL ?? "").toString().trim();
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname) || hostname.endsWith(".local");
    if (!isLocal && (!envBase || envBase.includes("localhost") || envBase.includes("127.0.0.1"))) {
      return "https://hirefit-backend-iqcc.onrender.com";
    }
  }
  return envBase;
};

const BASE = getApiBaseUrl().replace(/\/+$/, "");

export const isBackendConfigured = () => BASE.length > 0;

class BackendError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!isBackendConfigured()) {
    throw new BackendError(
      "Scoring service isn't connected yet. Set VITE_API_BASE_URL once the Node backend is deployed.",
    );
  }
  const headers = new Headers(init.headers);
  const rawSession = typeof window !== "undefined" ? localStorage.getItem("hf:simple-auth") : null;
  if (rawSession && !headers.has("authorization")) {
    try {
      const session = JSON.parse(rawSession) as { token?: string };
      if (session.token) headers.set("authorization", `Bearer ${session.token}`);
    } catch {
      /* ignore bad local auth cache */
    }
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new BackendError(text || `Request failed (${res.status})`, res.status);
  }
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  listJobs: () =>
    request<Array<{ id: string; title: string; jd_text: string; created_at: string }>>(
      "/api/jobs",
      { method: "GET" },
    ),
  createJob: (payload: { title: string; jd_text: string }) =>
    request<{ id: string; title: string; jd_text: string; created_at: string }>(
      "/api/jobs",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  listCandidates: (jobId: string) =>
    request<Array<Record<string, unknown>>>(
      `/api/jobs/${jobId}/candidates`,
      { method: "GET" },
    ),
  getCandidate: (candidateId: string) =>
    request<Record<string, unknown> | null>(
      `/api/candidates/${candidateId}`,
      { method: "GET" },
    ),
  updateCandidate: (candidateId: string, patch: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/api/candidates/${candidateId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      },
    ),
  listActivity: (candidateId: string) =>
    request<Array<Record<string, unknown>>>(
      `/api/candidates/${candidateId}/activity`,
      { method: "GET" },
    ),
  addActivity: (candidateId: string, payload: { action: string; notes?: string | null }) =>
    request<Record<string, unknown>>(
      `/api/candidates/${candidateId}/activity`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  importCandidates: (jobId: string, xlsx: File) => {
    const fd = new FormData();
    fd.append("file", xlsx);
    return request<{ imported: number; skipped: number }>(
      `/api/jobs/${jobId}/candidates/import`,
      { method: "POST", body: fd },
    );
  },
  uploadResume: (candidateId: string, resume: File) => {
    const fd = new FormData();
    fd.append("file", resume);
    return request<{ resume_url: string; resume_text: string; resume_analysis?: unknown; resume_file_type?: string }>(
      `/api/candidates/${candidateId}/resume`,
      { method: "POST", body: fd },
    );
  },
  scoreJob: (jobId: string) =>
    request<{ queued: number }>(`/api/jobs/${jobId}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  scoringStatus: (jobId: string) =>
    request<{ scored: number; total: number }>(
      `/api/jobs/${jobId}/scoring-status`,
      { method: "GET" },
    ),
  scoreCandidate: (candidateId: string) =>
    request<Record<string, unknown>>(`/api/candidates/${candidateId}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),

  // ── Admin endpoints ─────────────────────────────────────────────────────
  adminStats: () =>
    request<{ totalJobs: number; activeJobs: number; totalCandidates: number; hired: number; interviewing: number }>(
      "/api/admin/stats",
      { method: "GET" },
    ),
  adminListJobs: () =>
    request<Array<{ id: string; title: string; jd_text: string; created_at: string; is_active: boolean | null }>>(
      "/api/admin/jobs",
      { method: "GET" },
    ),
  adminDisableJob: (id: string) =>
    request<{ id: string; title: string; is_active: boolean }>(`/api/admin/jobs/${id}/disable`, { method: "PATCH" }),
  adminEnableJob: (id: string) =>
    request<{ id: string; title: string; is_active: boolean }>(`/api/admin/jobs/${id}/enable`, { method: "PATCH" }),
  adminDeleteJob: (id: string) =>
    request<{ deleted: boolean }>(`/api/admin/jobs/${id}`, { method: "DELETE" }),
  adminListCandidates: (jobId?: string) =>
    request<Array<Record<string, unknown>>>(
      `/api/admin/candidates${jobId ? `?jobId=${jobId}` : ""}`,
      { method: "GET" },
    ),
  adminDeleteCandidate: (id: string) =>
    request<{ deleted: boolean }>(`/api/admin/candidates/${id}`, { method: "DELETE" }),
  adminCreateUser: (payload: { email: string; password: string; role: string }) =>
    request<{ email: string; role: string; token: string; message: string }>(
      "/api/admin/users",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
};
