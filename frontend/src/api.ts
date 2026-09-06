const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/register") {
    // Token is invalid or points at a user that no longer exists (e.g. a reset
    // database) — clear it and bounce to login instead of surfacing a dead-end error.
    setToken(null);
    window.location.href = "/login";
    return new Promise<T>(() => {}); // navigation is in flight; never resolve
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : JSON.stringify(body?.error) || res.statusText);
  }
  return body as T;
}

export interface Session {
  id: string;
  label: string;
  phoneNumber: string | null;
  status: "AWAITING_LINK" | "AWAITING_SCAN" | "AWAITING_CODE" | "CONNECTED" | "DISCONNECTED" | "EXPIRED" | "REMOVED";
  lastConnectedAt: string | null;
  createdAt: string;
}

export interface SessionStats {
  totalSent: number;
  totalFailed: number;
  sentThisWeek: number;
  sentThisMonth: number;
  groupsCount: number;
  lastActivityAt: string | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  participantCount: number;
  whatsappGroupId: string;
  lastSyncedAt: string;
}

export interface ScheduledMessage {
  id: string;
  sessionId: string;
  text: string | null;
  mediaPath: string | null;
  mediaType: "IMAGE" | "DOCUMENT" | null;
  recurrence: string | null;
  sendAt: string;
  status: "PENDING" | "SENDING" | "SENT" | "FAILED" | "PARTIAL" | "ACTIVE" | "CANCELLED";
  targets: { groupId: string; group?: Group }[];
  createdAt: string;
}

export interface SendLog {
  id: string;
  groupId: string;
  group: { name: string };
  success: boolean;
  errorMessage: string | null;
  attemptedAt: string;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ token: string }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  listSessions: () => request<Session[]>("/sessions"),
  createSession: (label: string) => request<Session>("/sessions", { method: "POST", body: JSON.stringify({ label }) }),
  deleteSession: (id: string) => request<void>(`/sessions/${id}`, { method: "DELETE" }),
  linkQr: (id: string) => request<{ status: string }>(`/sessions/${id}/link/qr`, { method: "POST" }),
  linkPairing: (id: string, phoneNumber: string) =>
    request<{ status: string }>(`/sessions/${id}/link/pairing-code`, {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    }),

  listGroups: (sessionId: string) => request<Group[]>(`/sessions/${sessionId}/groups`),
  refreshGroups: (sessionId: string) => request<Group[]>(`/sessions/${sessionId}/groups/refresh`, { method: "POST" }),
  getSessionStats: (sessionId: string) => request<SessionStats>(`/sessions/${sessionId}/stats`),

  listScheduledMessages: (params: { status?: string; sessionId?: string } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<ScheduledMessage[]>(`/scheduled-messages${qs ? `?${qs}` : ""}`);
  },
  createScheduledMessage: (data: {
    sessionId: string;
    text?: string;
    mediaPath?: string;
    mediaType?: "IMAGE" | "DOCUMENT";
    groupIds: string[];
    sendAt: string;
    recurrence?: string;
  }) => request<ScheduledMessage>("/scheduled-messages", { method: "POST", body: JSON.stringify(data) }),
  cancelScheduledMessage: (id: string) => request<void>(`/scheduled-messages/${id}`, { method: "DELETE" }),
  getLogs: (id: string) => request<SendLog[]>(`/scheduled-messages/${id}/logs`),

  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ mediaPath: string; mediaType: "IMAGE" | "DOCUMENT" }>("/media", { method: "POST", body: form });
  },

  listTemplates: () => request<MessageTemplate[]>("/templates"),
  listTemplateTags: () => request<string[]>("/templates/tags"),
  createTemplate: (data: { name: string; body: string; tags: string[] }) =>
    request<MessageTemplate>("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<{ name: string; body: string; tags: string[] }>) =>
    request<MessageTemplate>(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => request<void>(`/templates/${id}`, { method: "DELETE" }),
};
