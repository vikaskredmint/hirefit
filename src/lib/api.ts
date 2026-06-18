// Thin client for the separate Node.js backend (XLSX/PDF/AI scoring).
// Set VITE_API_BASE_URL in .env when the backend is live. Until then,
// these helpers throw a friendly error and the UI surfaces it as a toast.

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").toString().trim();
const BASE = RAW_BASE.replace(/\/+$/, "");

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
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new BackendError(text || `Request failed (${res.status})`, res.status);
  }
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  importCandidates: (jobId: string, xlsx: File) => {
    const fd = new FormData();
    fd.append("file", xlsx);
    return request<{ imported: number; skipped: number }>(
      `/api/jobs/${jobId}/candidates/import`,
      { method: "POST", body: fd },
    );
  },
  uploadResume: (candidateId: string, pdf: File) => {
    const fd = new FormData();
    fd.append("file", pdf);
    return request<{ resume_url: string; resume_text: string }>(
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
};
