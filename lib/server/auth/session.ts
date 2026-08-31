import { createHash, randomBytes } from "node:crypto";

import { ForbiddenError } from "../api/errors.ts";

export const SESSION_COOKIE_NAME = "course_dekho_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export interface SessionTokenService {
  create(): string;
  hash(token: string): string;
}

export const defaultSessionTokens: SessionTokenService = {
  create: createSessionToken,
  hash: hashSessionToken,
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const values = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    .map((part) => part.slice(SESSION_COOKIE_NAME.length + 1));

  if (values.length !== 1 || !sessionTokenPattern.test(values[0])) return null;
  return values[0];
}

interface CookieOptions {
  secure: boolean;
}

export function serializeSessionCookie(
  token: string,
  options: CookieOptions & { expiresAt: Date }
): string {
  if (!sessionTokenPattern.test(token)) throw new Error("Invalid session token format.");
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Expires=${options.expiresAt.toUTCString()}`,
    "Priority=High",
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function serializeExpiredSessionCookie(options: CookieOptions): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "Priority=High",
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function assertTrustedOrigin(request: Request, applicationOrigin: string): void {
  const expectedOrigin = new URL(applicationOrigin).origin;
  const suppliedOrigin = request.headers.get("origin");

  if (suppliedOrigin) {
    let actualOrigin: string;
    try {
      actualOrigin = new URL(suppliedOrigin).origin;
    } catch {
      throw new ForbiddenError("The request origin is not allowed.");
    }
    if (actualOrigin !== expectedOrigin) {
      throw new ForbiddenError("The request origin is not allowed.");
    }
    return;
  }

  // Browser requests that omit Origin still carry Fetch Metadata. Requests
  // without either header are non-browser clients and remain usable.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new ForbiddenError("The request origin is not allowed.");
  }
}
