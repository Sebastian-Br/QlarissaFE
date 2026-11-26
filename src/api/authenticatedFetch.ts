const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const ACCESS_TOKEN_KEY = "jwt";
export const AUTH_CHANGED_EVENT = "qlarissa:access-token-changed";
const AUTH_EXPIRED_EVENT = "qlarissa:auth-expired";

let refreshInFlight: Promise<string | null> | null = null;

function readAccessToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function publishAuthChanged(): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  publishAuthChanged();
}

export function clearAccessToken(redirect = false): void {
  if (typeof localStorage !== "undefined")
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  publishAuthChanged();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    if (
      redirect &&
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/register"
    ) {
      window.location.assign("/login");
    }
  }
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      (character) => character.charCodeAt(0),
    );
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function accessTokenSubject(token: string): string | null {
  const subject = decodeTokenPayload(token)?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : null;
}

export class AuthenticatedAccountChangedError extends Error {
  constructor() {
    super("The active account changed while the request was pending.");
    this.name = "AuthenticatedAccountChangedError";
  }
}

function hasUsableAccessToken(token: string): boolean {
  const exp = decodeTokenPayload(token)?.exp;
  return typeof exp === "number" && exp > Date.now() / 1000 + 60;
}

async function refreshAccessTokenAfterTokenChange(
  previousToken: string | null,
): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = async (): Promise<string> => {
        const latestToken = readAccessToken();
        if (
          latestToken &&
          latestToken !== previousToken &&
          hasUsableAccessToken(latestToken)
        ) {
          return latestToken;
        }

        const response = await fetch(`${BASE_URL}/api/Account/Refresh`, {
          method: "POST",
          credentials: "include",
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error("The refresh session has expired.");
        const result: unknown = await response.json();
        const token =
          typeof result === "object" &&
          result !== null &&
          "accessToken" in result &&
          typeof result.accessToken === "string"
            ? result.accessToken
            : null;
        if (!token) throw new Error("The refresh response was invalid.");
        setAccessToken(token);
        return token;
      };

      if (typeof navigator !== "undefined" && navigator.locks) {
        return await navigator.locks.request("qlarissa:refresh-token", refresh);
      }
      return await refresh();
    } catch {
      clearAccessToken(true);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function getAccessTokenForSignalR(): Promise<string> {
  const token = readAccessToken();
  if (token && hasUsableAccessToken(token)) return token;

  const refreshed = await refreshAccessTokenAfterTokenChange(token);
  if (!refreshed) throw new Error("A valid sign-in session is required.");
  return refreshed;
}

function isSessionEndpoint(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return /\/api\/Account\/(?:Login|Register|Refresh|Logout)(?:\?|$)/i.test(url);
}

function withAuthorization(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return { ...init, credentials: "include", headers };
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  expectedSubject?: string,
): Promise<Response> {
  let initialToken = readAccessToken();
  if (expectedSubject && (!initialToken || accessTokenSubject(initialToken) !== expectedSubject)) {
    initialToken = await refreshAccessTokenAfterTokenChange(initialToken);
    if (!initialToken || accessTokenSubject(initialToken) !== expectedSubject)
      throw new AuthenticatedAccountChangedError();
  }
  const response = await fetch(input, withAuthorization(init, initialToken));
  if (response.status !== 401 || isSessionEndpoint(input)) return response;

  const latestToken = readAccessToken();
  const retryToken =
    latestToken && latestToken !== initialToken
      ? latestToken
      : await refreshAccessTokenAfterTokenChange(initialToken);
  if (!retryToken) return response;
  if (expectedSubject && accessTokenSubject(retryToken) !== expectedSubject)
    throw new AuthenticatedAccountChangedError();

  const retried = await fetch(input, withAuthorization(init, retryToken));
  if (retried.status === 401) clearAccessToken(true);
  return retried;
}
