import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * This is only used for development with Replit. For standalone builds,
 * the app uses the user-configured server URL from AuthContext instead.
 * @returns {string | null} The API base URL, or null if not configured
 */
export function getApiUrl(): string | null {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    // In standalone builds, EXPO_PUBLIC_DOMAIN won't be set.
    // The app should use the user-configured server URL from AuthContext instead.
    return null;
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error("API not configured. Use AuthContext.getApiUrl() for MeterFlo server calls.");
  }
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data 
      ? { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-Mobile-App": "MeterFlo" } 
      : { "X-Requested-With": "XMLHttpRequest", "X-Mobile-App": "MeterFlo" },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    if (!baseUrl) {
      // In standalone builds, EXPO_PUBLIC_DOMAIN isn't set.
      // Queries should use explicit queryFn with AuthContext.serverUrl instead.
      throw new Error(
        "Default queryFn not available in standalone builds. " +
        "Use AuthContext.getApiUrl() with an explicit queryFn for MeterFlo server calls."
      );
    }
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "X-Mobile-App": "MeterFlo",
      },
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Create QueryClient without a default queryFn to avoid crashes in standalone builds.
// The app uses AuthContext.serverUrl for all MeterFlo API calls, so the default
// queryFn from EXPO_PUBLIC_DOMAIN is not needed.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // No default queryFn - each query must provide its own or use AuthContext
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
