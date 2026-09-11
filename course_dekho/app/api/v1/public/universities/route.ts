export const runtime = "nodejs";

// Deliberately public: the sign-up form needs the university list before the
// person has an account or a session cookie to send. See listPublicUniversities
// in lib/server/catalog/http-handlers.ts for why this is safe to leave unauthenticated
// while every other catalog route stays gated to logged-in users.
export async function GET(): Promise<Response> {
  const { catalogHttpHandlers } = await import("@/lib/server/catalog/runtime");
  return catalogHttpHandlers.listPublicUniversities();
}
