import { test, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as store from "../../src/lib/audit/store";
import type { AuditRecord } from "../../src/lib/audit/types";

// store.ts reads AUDIT_DATA_DIR at call time rather than at module load, so a
// plain import is enough — each test just repoints the env var at its own
// throwaway directory. (Re-importing per test would not work: Playwright
// caches modules, and a query-string cache-buster does not apply to TS paths.)
async function freshStore() {
  const dir = await mkdtemp(join(tmpdir(), "audit-store-"));
  process.env.AUDIT_DATA_DIR = dir;
  return { dir, ...store };
}

const record = (over: Partial<AuditRecord> = {}): AuditRecord => ({
  id: "abc12345",
  url: "https://example.com/",
  normalizedUrl: "https://example.com",
  createdAt: new Date().toISOString(),
  lang: "es",
  page: { status: 200, finalUrl: "https://example.com/", redirects: 0, bytes: 100, title: "x" },
  checks: [{ id: "seo.title.present", status: "pass" }],
  vitals: null,
  vitalsError: null,
  ...over,
});

// These cases mutate a shared process.env value, so they must not interleave.
test.describe.configure({ mode: "serial" });

test.describe("store", () => {
  test("round-trips a record", async () => {
    const { dir, saveAudit, getAudit } = await freshStore();
    await saveAudit(record());
    expect((await getAudit("abc12345"))?.url).toBe("https://example.com/");
    await rm(dir, { recursive: true, force: true });
  });

  test("returns null for an unknown id", async () => {
    const { dir, getAudit } = await freshStore();
    expect(await getAudit("nope0000")).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  test("refuses ids that are not plain alphanumerics (path traversal)", async () => {
    const { dir, getAudit } = await freshStore();
    // Create a file that path traversal could reach if the regex guard wasn't there.
    // recordPath appends .json, so "../secret" becomes "../secret.json"
    const parentDir = join(dir, "..");
    const secretPath = join(parentDir, "secret.json");
    await writeFile(secretPath, '{"id":"fake","url":"https://evil.com","normalizedUrl":"https://evil.com","createdAt":"2026-01-01T00:00:00Z","lang":"en","page":{"status":200,"finalUrl":"https://evil.com","redirects":0,"bytes":100,"title":"Evil"},"checks":[],"vitals":null,"vitalsError":null}', "utf8");
    // Without the ID check, this would read the secret file; with the check, it returns null
    expect(await getAudit("../secret")).toBeNull();
    await rm(secretPath, { force: true });
    await rm(dir, { recursive: true, force: true });
  });

  test("finds a cached record by normalized url within the window", async () => {
    const { dir, saveAudit, findCachedByUrl } = await freshStore();
    await saveAudit(record());
    expect(await findCachedByUrl("https://example.com", 60_000)).toBe("abc12345");
    await rm(dir, { recursive: true, force: true });
  });

  test("ignores a cached record older than the window", async () => {
    const { dir, saveAudit, findCachedByUrl } = await freshStore();
    const old = new Date(Date.now() - 48 * 3600_000).toISOString();
    await saveAudit(record({ createdAt: old }));
    expect(await findCachedByUrl("https://example.com", 24 * 3600_000)).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  test("merges a patch into an existing record", async () => {
    const { dir, saveAudit, updateAudit, getAudit } = await freshStore();
    await saveAudit(record());
    await updateAudit("abc12345", {
      vitals: {
        score: 88,
        lab: { lcp: 1200, cls: 0.02, tbt: 90, fcp: 900 },
        field: null,
        transferBytes: 500_000,
        renderBlockingMs: 120,
        imageSavingsBytes: 0,
      },
    });
    const after = await getAudit("abc12345");
    expect(after?.vitals?.score).toBe(88);
    expect(after?.url).toBe("https://example.com/"); // untouched
    await rm(dir, { recursive: true, force: true });
  });

  test("newAuditId produces distinct url-safe ids", async () => {
    const { dir, newAuditId } = await freshStore();
    const ids = new Set(Array.from({ length: 200 }, () => newAuditId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{8}$/);
    await rm(dir, { recursive: true, force: true });
  });
});
