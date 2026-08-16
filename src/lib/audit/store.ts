import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isAuditId } from "./id";
import type { AuditRecord } from "./types";

const TTL_MS = 30 * 24 * 3600_000; // 30 days

/**
 * Read at call time, not at module load: the value must point OUTSIDE the
 * release directory (the VPS deploy does `git reset --hard`, and /opt/dishape
 * is replaced wholesale), and tests point it at a temp dir per case.
 */
const dataDir = () => process.env.AUDIT_DATA_DIR ?? "/var/lib/dishape/audits";

const recordPath = (id: string) => join(dataDir(), `${id}.json`);

/**
 * Path of the url -> id pointer.
 *
 * The "u-" prefix cannot collide with a record: ids are /^[a-z0-9]{8}$/ (see
 * id.ts), which has no hyphen, and getAudit refuses anything else before it
 * touches the filesystem. Hashed rather than encoded so the name is a fixed
 * safe length whatever the visitor typed.
 */
const indexPath = (normalizedUrl: string) =>
  join(
    dataDir(),
    `u-${createHash("sha256").update(normalizedUrl).digest("hex").slice(0, 24)}.json`,
  );

export function newAuditId(): string {
  // 5 bytes → 8 base36 chars. Random, not sequential: the id must not leak volume.
  return randomBytes(5).toString("hex").slice(0, 8);
}

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
}

export async function saveAudit(record: AuditRecord): Promise<void> {
  await ensureDir();
  await writeFile(recordPath(record.id), JSON.stringify(record), "utf8");
  // The pointer is written after the record, so the index never names an id
  // that is not on disk yet. The reverse (a record with no pointer) only costs
  // a cache miss.
  await writeFile(
    indexPath(record.normalizedUrl),
    JSON.stringify({ id: record.id, createdAt: record.createdAt }),
    "utf8",
  );
  void sweep(); // fire-and-forget; a failed sweep must never fail a request
}

export async function getAudit(id: string): Promise<AuditRecord | null> {
  // Reject anything that is not a plain id before it reaches the filesystem.
  if (!isAuditId(id)) return null;
  try {
    return JSON.parse(await readFile(recordPath(id), "utf8")) as AuditRecord;
  } catch {
    return null;
  }
}

export async function updateAudit(
  id: string,
  patch: Partial<AuditRecord>,
): Promise<AuditRecord | null> {
  const current = await getAudit(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await writeFile(recordPath(id), JSON.stringify(next), "utf8");
  return next;
}

/**
 * Id of a recent audit for this normalized URL, or null.
 *
 * One index probe, not a scan. /api/audit calls this BEFORE spending a rate
 * limit token (deliberately — a repeat visit is not abuse), so this is work an
 * unauthenticated caller can ask for at will; it must not grow with the number
 * of stored records. The previous version read and JSON.parsed every file in
 * the directory, which with a 30-day TTL is unbounded.
 *
 * Records written before the index existed have no pointer. They simply miss
 * once, get re-audited, and are indexed from then on.
 */
export async function findCachedByUrl(
  normalizedUrl: string,
  maxAgeMs: number,
): Promise<string | null> {
  await ensureDir();

  let pointer: { id?: unknown; createdAt?: unknown };
  try {
    pointer = JSON.parse(await readFile(indexPath(normalizedUrl), "utf8"));
  } catch {
    return null; // no pointer, unreadable, or corrupt — all mean "not cached"
  }

  const { id, createdAt } = pointer;
  if (typeof id !== "string" || typeof createdAt !== "string") return null;
  if (!isAuditId(id)) return null;
  if (Date.parse(createdAt) < Date.now() - maxAgeMs) return null;

  // The sweep deletes records and pointers independently, so a pointer can
  // outlive what it names. Returning that id would hand the visitor a 404.
  try {
    await stat(recordPath(id));
  } catch {
    return null;
  }

  return id;
}

/** Drop records past the TTL. Lazy — runs after a write, no cron needed. */
async function sweep(): Promise<void> {
  try {
    const files = await readdir(dataDir());
    const cutoff = Date.now() - TTL_MS;
    await Promise.all(
      files.map(async (file) => {
        if (!file.endsWith(".json")) return;
        const path = join(dataDir(), file);
        const info = await stat(path);
        if (info.mtimeMs < cutoff) await rm(path, { force: true });
      }),
    );
  } catch {
    // Sweeping is housekeeping; failing it must not surface to the user.
  }
}
