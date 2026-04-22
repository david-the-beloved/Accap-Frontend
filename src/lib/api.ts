export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://accap-backend.fly.dev/api/v1";

export type AuthResponse = {
  access_token: string;
  token_type: string;
};

export type UserProfile = {
  id: number;
  email: string;
  current_streak: number;
  highest_streak: number;
};

export type ReadingPlan = {
  id: number;
  user_id: number;
  goal_type: "daily" | "weekly";
  pages_per_day_goal: number;
  chapters_per_day_goal: number;
  updated_at: string;
};

export type DailyLog = {
  id: number;
  user_id: number;
  date: string;
  page_number: number;
  chapter: string;
  highlighted_text: string;
  goal_met: boolean;
};

export type Note = {
  id: number;
  user_id: number;
  page_number: number;
  chapter: string;
  content: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("access_token");
}

export function setToken(token: string): void {
  localStorage.setItem("access_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("access_token");
}

function parseErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: string };
    return parsed.detail ?? raw;
  } catch {
    return raw;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  withAuth = false,
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (withAuth) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError("Network error. Please try again.", 0);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      parseErrorMessage(text) || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export type LeaderboardEntry = {
  email: string;
  current_streak: number;
  highest_streak: number;
};

export async function signup(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/me", undefined, true);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>("/leaderboard");
}

export async function getMyReadingPlan(): Promise<ReadingPlan | null> {
  return apiFetch<ReadingPlan | null>("/reading-plans/me", undefined, true);
}

export async function upsertReadingPlan(payload: {
  goal_type: "daily" | "weekly";
  pages_per_day_goal: number;
  chapters_per_day_goal: number;
}): Promise<ReadingPlan> {
  return apiFetch<ReadingPlan>("/reading-plans/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, true);
}

export async function updateReadingProgress(payload: {
  page_number: number;
  chapter: string;
  highlighted_text: string;
  book_version?: string;
  baseline_chapter?: string;
}): Promise<DailyLog> {
  return apiFetch<DailyLog>("/reading-progress/update", {
    method: "POST",
    body: JSON.stringify(payload),
  }, true);
}

export async function getLatestReadingProgress(bookVersion?: string): Promise<DailyLog | null> {
  const suffix = bookVersion ? `?book_version=${encodeURIComponent(bookVersion)}` : "";
  return apiFetch<DailyLog | null>(`/reading-progress/latest${suffix}`, undefined, true);
}

export async function getNoteByPage(pageNumber: number, bookVersion?: string): Promise<Note | null> {
  const suffix = bookVersion ? `&book_version=${encodeURIComponent(bookVersion)}` : "";
  return apiFetch<Note | null>(`/notes/by-page?page_number=${pageNumber}${suffix}`, undefined, true);
}

export async function upsertNote(payload: {
  page_number: number;
  chapter: string;
  content: string;
  book_version?: string;
}): Promise<Note> {
  return apiFetch<Note>("/notes/upsert", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, true);
}

export async function downloadNotesPdf(bookVersion?: string): Promise<Blob> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const suffix = bookVersion ? `?book_version=${encodeURIComponent(bookVersion)}` : "";
  const response = await fetch(`${API_BASE}/notes/export/pdf${suffix}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorMessage(text) || "Failed to export notes PDF");
  }

  return response.blob();
}
