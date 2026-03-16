import type { User } from "@/lib/api";

const TOKEN_KEY = "creator_growth_token";
const USER_KEY = "creator_growth_user";

function isBrowser() {
  return typeof window !== "undefined";
}

export function setAuthSession(token: string, user: User): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
