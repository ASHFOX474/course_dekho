import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("each academic read route delegates to the protected catalog handler at request time", async () => {
  for (const [path, handler] of [
    ["app/api/v1/universities/route.ts", "listUniversities"],
    ["app/api/v1/universities/[universityId]/semesters/route.ts", "listSemesters"],
    ["app/api/v1/courses/route.ts", "listCourses"],
    ["app/api/v1/courses/[courseId]/route.ts", "getCourse"],
    ["app/api/v1/courses/[courseId]/topics/route.ts", "listTopics"],
    ["app/api/v1/courses/[courseId]/resources/route.ts", "listCourseResources"],
    ["app/api/v1/topics/[topicId]/resources/route.ts", "listTopicResources"],
    ["app/api/v1/resources/[resourceId]/route.ts", "getApprovedResource"],
  ]) {
    const route = await source(path);
    assert.match(route, /export async function GET\b/);
    assert.match(route, /runtime = "nodejs"/);
    assert.match(route, /await import\("@\/lib\/server\/catalog\/runtime"\)/);
    assert.match(route, new RegExp(`catalogHttpHandlers\\.${handler}\\(`));
  }
});

test("catalog client uses authenticated no-store API reads and shared DTO types", async () => {
  const client = await source("lib/client/catalog-api.ts");

  assert.match(client, /import type[\s\S]*lib\/server\/api\/dtos/);
  assert.match(client, /credentials:\s*"same-origin"/);
  assert.match(client, /cache:\s*"no-store"/);
  assert.doesNotMatch(client, /lib\/data\//);
});

test("academic pages are migrated sequentially away from direct mock imports", async () => {
  for (const path of [
    "app/courses/page.tsx",
    "app/courses/[courseId]/page.tsx",
    "app/courses/[courseId]/topics/[topicId]/page.tsx",
    "app/resources/[resourceId]/page.tsx",
  ]) {
    const page = await source(path);
    assert.match(page, /@\/lib\/client\/catalog-api/);
    assert.doesNotMatch(page, /@\/lib\/data\/(?:academics|resources|activity)/);
  }
});
