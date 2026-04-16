import { QueryClient, QueryCache, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    // Try to parse JSON body and extract the "message" field for clean error messages
    try {
      const json = JSON.parse(text);
      if (json && typeof json.message === "string") {
        throw new Error(json.message);
      }
    } catch (e) {
      // Re-throw if it was the Error we created above
      if (e instanceof Error && text && e.message !== text) throw e;
    }
    throw new Error(text || res.statusText);
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
 * Strips the HTTP status prefix (e.g. "500: ") and parses JSON bodies
 * so mutations can show a clean server message in their onError toasts.
 */
export function parseErrorMessage(err: Error | unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred.";
  const raw = err.message;
  // Strip leading "NNN: " status prefix if present
  const withoutStatus = raw.replace(/^\d{3}:\s*/, "");
  // If the remainder looks like JSON, try to extract "message"
  try {
    const parsed = JSON.parse(withoutStatus);
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
    // not JSON, use as-is
  }
  return withoutStatus || "An unexpected error occurred.";
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

// Global query error handler — fires a toast for any failed query so pages
// never go silently blank. Skips 401s (handled by auth redirect).
const queryCache = new QueryCache({
  onError: (error: unknown) => {
    const msg = error instanceof Error ? error.message : "An unexpected error occurred.";
    // Skip 401 errors — the auth layer handles those
    if (msg.includes("401") || msg === "Unauthorized") return;
    toast({
      title: "Failed to load data",
      description: msg,
      variant: "destructive",
    });
  },
});

export const queryClient = new QueryClient({
  queryCache,
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
