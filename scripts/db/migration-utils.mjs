import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const migrationFilenamePattern = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;

export function checksumSql(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function extractVersion(filename) {
  const match = migrationFilenamePattern.exec(filename);
  if (!match) {
    throw new Error(`Invalid migration filename: ${filename}`);
  }

  return match[1];
}

export function parseEnvValue(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const assignment = new RegExp(`^\\s*(?:export\\s+)?${escapedKey}\\s*=\\s*(.*)$`);

  for (const line of source.split(/\r?\n/)) {
    const match = assignment.exec(line);
    if (!match) continue;

    const rawValue = match[1].trim();
    if (
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")))
    ) {
      return rawValue.slice(1, -1);
    }

    return rawValue.replace(/\s+#.*$/, "").trim();
  }

  return undefined;
}

export function seedIsAllowed(nodeEnvironment, explicitOverride) {
  return (
    nodeEnvironment !== "production" ||
    explicitOverride?.trim().toLowerCase() === "true"
  );
}

export async function resolveDatabaseUrl(repositoryRoot, environment = process.env) {
  if (environment.DATABASE_URL) return environment.DATABASE_URL;

  for (const filename of [".env.local", ".env"]) {
    try {
      const source = await readFile(new URL(filename, repositoryRoot), "utf8");
      const databaseUrl = parseEnvValue(source, "DATABASE_URL");
      if (databaseUrl) return databaseUrl;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  throw new Error("DATABASE_URL is required in the environment, .env.local, or .env");
}

export async function readVersionedSql(directory) {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const seenVersions = new Set();

  return Promise.all(
    filenames.map(async (filename) => {
      const version = extractVersion(filename);
      if (seenVersions.has(version)) {
        throw new Error(`Duplicate migration version: ${version}`);
      }
      seenVersions.add(version);

      const sql = await readFile(new URL(filename, directory), "utf8");
      return { version, filename, sql, checksum: checksumSql(sql) };
    })
  );
}
