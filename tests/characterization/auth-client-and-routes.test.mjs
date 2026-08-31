import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("each auth route delegates to the server auth handler at request time", async () => {
  for (const [path, method, handler] of [
    ["app/api/v1/auth/register/route.ts", "POST", "register"],
    ["app/api/v1/auth/login/route.ts", "POST", "login"],
    ["app/api/v1/auth/logout/route.ts", "POST", "logout"],
    ["app/api/v1/session/route.ts", "GET", "session"],
  ]) {
    const route = await source(path);
    assert.match(route, new RegExp(`export async function ${method}\\b`));
    assert.match(route, /runtime = "nodejs"/);
    assert.match(route, /authHttpHandlers/);
    assert.match(route, new RegExp(`authHttpHandlers\\.${handler}\\(request\\)`));
  }
});

test("the React auth context uses cookie-backed APIs and never localStorage or mock passwords", async () => {
  const context = await source("lib/auth/AuthContext.tsx");

  assert.match(context, /fetch\("\/api\/v1\/session"/);
  assert.match(context, /fetch\("\/api\/v1\/auth\/login"/);
  assert.match(context, /fetch\("\/api\/v1\/auth\/logout"/);
  assert.doesNotMatch(context, /localStorage/);
  assert.doesNotMatch(context, /findUserByCredentials|getUserById/);
});

test("mock user records no longer retain credential fields or compare plaintext passwords", async () => {
  const users = await source("lib/data/users.ts");
  const types = await source("lib/types.ts");

  assert.doesNotMatch(users, /findUserByCredentials/);
  assert.doesNotMatch(users, /^\s*password:\s*["']/m);
  assert.doesNotMatch(types, /^\s*password:\s*string/m);
});
