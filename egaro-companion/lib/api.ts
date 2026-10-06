// Small helpers shared by the API routes.
import { getCurrentUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request-guards";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// Every protected API route starts with this: same-origin check + logged-in check.
// Returns either the user, or a ready-made error Response to return immediately.
export async function requireUserApi(request: Request) {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return { response: jsonError("Request blocked.", 403) } as const;
  }
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("Please log in.", 401) } as const;
  return { user } as const;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
