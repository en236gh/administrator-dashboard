import { cache } from "react";
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  getSessionUser,
  setSessionCookies,
} from "@/lib/auth/session";
import type { ApiEnvelope, LoginResponse } from "@/lib/types/api";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "https://fourth-91rl.onrender.com";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
  /** Internal: skip 401 → refresh → retry. */
  _retried?: boolean;
  /** Scheduling mutations require an explicit user retry. */
  noRetry?: boolean;
};

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("Invalid response from server", response.status);
  }

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.message || `Request failed (${response.status})`,
      response.status,
      json,
    );
  }

  return json;
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  const user = await getSessionUser();
  if (!refreshToken || !user) {
    await clearSessionCookies();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    const envelope = await parseEnvelope<LoginResponse>(response);
    await setSessionCookies({
      accessToken: envelope.data.accessToken,
      refreshToken: envelope.data.refreshToken ?? refreshToken,
      email: user.email,
      name: user.name,
    });
    return envelope.data.accessToken;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status === 400 || status === 401 || status === 403) {
      await clearSessionCookies();
    }
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshPromise = performRefreshAccessToken();
  refreshInFlight = refreshPromise;
  try {
    return await refreshPromise;
  } finally {
    if (refreshInFlight === refreshPromise) refreshInFlight = null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, _retried = false } = options;

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = options.token ?? (auth ? await getAccessToken() : null);
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (auth && response.status === 401 && !_retried && !options.noRetry) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiRequest<T>(path, {
        ...options,
        token: nextToken,
        _retried: true,
      });
    }
  }

  const envelope = await parseEnvelope<T>(response);
  return envelope.data;
}

/**
 * Request-level memoization (React cache) so parallel server components
 * sharing the same path only hit the backend once per render.
 */
const cachedRequest = cache(async (path: string) => apiRequest<unknown>(path));

export function getCachedJson<T>(path: string): Promise<T> {
  return cachedRequest(path) as Promise<T>;
}
