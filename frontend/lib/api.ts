/*
 * The only way the frontend reaches data: typed calls to the Mmry REST API
 * under /api/v1 (same origin; proxy.ts forwards it to the backend).
 */
import { CSRF_HEADER, getAccessToken, refreshSession, setSession } from "@/lib/auth";
import type {
  ApiErrorBody,
  Insights,
  IntentOutcome,
  MindCheck,
  MindCheckAnswer,
  Patient,
  PatientAnalytics,
  PatientUpdate,
  Person,
  SafetyState,
  SessionInput,
  SessionResponse,
  SessionSummary,
  Task,
  User,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /* No response at all: offline, DNS, the server is down. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function send<T>(method: Method, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network", "network unavailable");
  }

  // An expired access token: refresh once, then replay the request.
  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const session = await refreshSession().catch(() => null);
    if (session) return send<T>(method, path, body, true);
    setSession(null);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = (json as ApiErrorBody | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? res.statusText, err?.details);
  }
  return json as T;
}

const p = (patientId: string) => `/patients/${encodeURIComponent(patientId)}`;

export const api = {
  auth: {
    register: (body: { email: string; password: string; fullName: string }) =>
      send<SessionResponse>("POST", "/auth/register", body),
    login: (body: { email: string; password: string }) => send<SessionResponse>("POST", "/auth/login", body),
    me: () => send<{ user: User }>("GET", "/auth/me"),
  },

  patients: {
    list: () => send<{ patients: Patient[] }>("GET", "/patients"),
    create: (body: { displayName: string; language: string }) => send<{ patient: Patient }>("POST", "/patients", body),
    get: (id: string) => send<{ patient: Patient }>("GET", p(id)),
    update: (id: string, body: PatientUpdate) => send<{ patient: Patient }>("PATCH", p(id), body),
    setPin: (id: string, pin: string | null) => send<{ patient: Patient }>("PUT", `${p(id)}/pin`, { pin }),
    verifyPin: (id: string, pin: string) => send<{ ok: true }>("POST", `${p(id)}/pin/verify`, { pin }),
  },

  tasks: {
    list: (id: string, day: string) => send<{ day: string; tasks: Task[] }>("GET", `${p(id)}/tasks?day=${day}`),
    set: (id: string, taskId: string, day: string, done: boolean) =>
      send<{ day: string; tasks: Task[] }>("PUT", `${p(id)}/tasks/${encodeURIComponent(taskId)}`, { day, done }),
  },

  people: {
    list: (id: string) => send<{ people: Person[] }>("GET", `${p(id)}/people`),
    create: (id: string, body: { name: string; relation: string | null; note: string | null; emoji: string; isPlace: boolean }) =>
      send<{ person: Person }>("POST", `${p(id)}/people`, body),
    remove: (id: string, personId: string) => send<void>("DELETE", `${p(id)}/people/${encodeURIComponent(personId)}`),
    pinHere: (id: string, personId: string) => send<{ person: Person }>("PUT", `${p(id)}/people/${encodeURIComponent(personId)}/location`),
    clearPin: (id: string, personId: string) => send<{ person: Person }>("DELETE", `${p(id)}/people/${encodeURIComponent(personId)}/location`),
  },

  sessions: {
    record: (id: string, sessions: SessionInput[]) =>
      send<{ sessions: SessionSummary[]; created: number }>("POST", `${p(id)}/sessions`, { sessions }),
    list: (id: string, limit = 50) => send<{ sessions: SessionSummary[] }>("GET", `${p(id)}/sessions?limit=${limit}`),
  },

  mindChecks: {
    record: (id: string, body: { clientRef: string; takenAt: string; answers: MindCheckAnswer[] }) =>
      send<{ mindCheck: MindCheck }>("POST", `${p(id)}/mind-checks`, body),
    list: (id: string, limit = 10) => send<{ mindChecks: MindCheck[] }>("GET", `${p(id)}/mind-checks?limit=${limit}`),
  },

  insights: {
    get: (id: string, day: string) => send<Insights>("GET", `${p(id)}/insights?day=${day}`),
    analytics: (id: string, days: number) => send<PatientAnalytics>("GET", `${p(id)}/analytics?days=${days}`),
  },

  safety: {
    get: (id: string) => send<SafetyState>("GET", `${p(id)}/safety`),
    updateZone: (id: string, body: Partial<{ radiusM: 200 | 500 | 1000 | 2000; armed: boolean; trackingEnabled: boolean }>) =>
      send<SafetyState>("PATCH", `${p(id)}/safety/zone`, body),
    setHome: (id: string, body: { kind: "lastFix" } | { kind: "place"; personId: string }) =>
      send<SafetyState>("PUT", `${p(id)}/safety/home`, body),
    reportFix: (id: string, fix: { lat: number; lon: number; accuracyM: number }) =>
      send<{ transition: "out" | "in" | null; state: SafetyState }>("POST", `${p(id)}/safety/fixes`, fix),
    sos: (id: string) => send<SafetyState>("POST", `${p(id)}/safety/sos`),
  },

  assistant: {
    intent: (id: string, body: { text: string; lang: string; source: "speech" | "chip"; speechConfidence: number | null }) =>
      send<IntentOutcome>("POST", `${p(id)}/assistant/intent`, body),
  },
};

export { CSRF_HEADER };
