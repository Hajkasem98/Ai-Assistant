import { callApi } from "../api/apiClient";
import type { ChatRequest, SourceHit } from "../types/chat";

function getApiBaseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL as string;

  if (!base) {
    throw new Error(
      "Mangler VITE_API_BASE_URL. Lag frontend/.env med f.eks. VITE_API_BASE_URL=https://localhost:56510 og restart npm run dev."
    );
  }

  return base;
}

export async function streamBackend(
  req: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<void> {
  const base = getApiBaseUrl();

  const res = await callApi(`${base}/api/Chat/stream`, {
    method: "POST",
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
  }

  if (!res.body) {
    throw new Error("Backend returnerte ingen stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) onChunk(chunk);
    }

    const lastChunk = decoder.decode();
    if (lastChunk) onChunk(lastChunk);
  } finally {
    reader.releaseLock();
  }
}

export async function fetchSources(req: ChatRequest): Promise<SourceHit[]> {
  const base = getApiBaseUrl();

  const res = await callApi(`${base}/api/Chat/sources`, {
    method: "POST",
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as SourceHit[];
}
