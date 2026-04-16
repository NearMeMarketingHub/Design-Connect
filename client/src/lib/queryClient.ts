import { QueryClient, QueryCache, MutationCache, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function tryParseMessage(text: string): string | null {
  try {
    const json = JSON.parse(text);
    if (json && typeof json.message === "string") return json.message;
  } catch {
    // not valid JSON — fall through
  }
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = tryParseMessage(text) ?? text ?? res.statusText;
    throw new ApiError(res.status, message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Extracts a clean, user-readable message from an error thrown by apiRequest.
 * Since throwIfResNotOk already parses JSON bodies, err.message is typically
 * clean. This helper strips any residual "NNN: " status prefix as a safety net.
 */
export function parseErrorMessage(err: Error | unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred.";
  const raw = err.message;
  // Strip leading "NNN: " status prefix if still present (legacy paths)
  const withoutStatus = raw.replace(/^\d{3}:\s*/, "");
  // If the remainder looks like JSON, try to extract "message"
  const fromJson = tryParseMessage(withoutStatus);
  return fromJson ?? withoutStatus ?? "An unexpected error occurred.";
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Tracks whether a session-expiry redirect is already in flight so we don't
// fire multiple toasts / redirects when several queries fail simultaneously.
let sessionExpiryRedirectPending = false;

function handleSessionExpiry() {
  if (sessionExpiryRedirectPending) return;

  // Don't redirect if the user is already on a login/auth page.
  const currentPath = window.location.pathname;
  if (currentPath === "/auth" || currentPath === "/admin-login" || currentPath === "/") return;

  sessionExpiryRedirectPending = true;

  toast({
    title: "Session expired",
    description: "Your session has expired. Please log in again.",
    variant: "destructive",
  });

  // Give the toast a moment to appear before navigating away.
  setTimeout(() => {
    const isAdminPath = currentPath.startsWith("/admin");
    window.location.href = isAdminPath ? "/admin-login" : "/auth";
  }, 1500);
}

// Global query error handler — fires a toast for any failed query so pages
// never go silently blank. Handles 401s with an auth redirect.
const queryCache = new QueryCache({
  onError: (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      handleSessionExpiry();
      return;
    }
    const msg = error instanceof Error ? error.message : "An unexpected error occurred.";
    toast({
      title: "Failed to load data",
      description: msg,
      variant: "destructive",
    });
  },
});

// Global mutation error handler — same 401 handling as queries.
const mutationCache = new MutationCache({
  onError: (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      handleSessionExpiry();
      return;
    }
  },
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
