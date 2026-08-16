import { test, expect } from "@playwright/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  vitalsErrorAt: null,
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

  // findCachedByUrl runs BEFORE the rate limiter on /api/audit (deliberately:
  // a repeat visit is not abuse), so its cost is an unauthenticated cost and
  // must not scale with how many records the store holds. That is enforced by
  // an index rather than by a test: a timing assertion was tried and thrown
  // away, because the records a test writes are still in the page cache and a
  // 60MB scan measured 89ms — fast enough that the bound would not discriminate.
  // What IS asserted here is the index being the source of truth, which no
  // scan-every-record implementation can satisfy.
  test("resolves through the index, not by scanning record contents", async () => {
    const { dir, saveAudit, findCachedByUrl } = await freshStore();
    await saveAudit(record());

    // Rewrite the record so its own normalizedUrl no longer matches. A scan
    // would now miss; the index still knows this id was stored for that url.
    const stored = JSON.parse(await readFile(join(dir, "abc12345.json"), "utf8"));
    stored.normalizedUrl = "https://something-else.example";
    await writeFile(join(dir, "abc12345.json"), JSON.stringify(stored), "utf8");

    expect(await findCachedByUrl("https://example.com", 60_000)).toBe("abc12345");
    await rm(dir, { recursive: true, force: true });
  });

  test("does not return an id whose record has been swept away", async () => {
    const { dir, saveAudit, findCachedByUrl } = await freshStore();
    await saveAudit(record());
    // Delete the record but leave the index behind, which is exactly the state
    // the sweep produces if it removes one before the other.
    await rm(join(dir, "abc12345.json"), { force: true });
    expect(await findCachedByUrl("https://example.com", 60_000)).toBeNull();
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
