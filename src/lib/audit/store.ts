import { randomBytes } from "node:crypto";
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

/** Id of a recent audit for this normalized URL, or null. */
export async function findCachedByUrl(
  normalizedUrl: string,
  maxAgeMs: number,
): Promise<string | null> {
  await ensureDir();
  let files: string[];
  try {
    files = await readdir(dataDir());
  } catch {
    return null;
  }

  const cutoff = Date.now() - maxAgeMs;
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const rec = JSON.parse(
        await readFile(join(dataDir(), file), "utf8"),
      ) as AuditRecord;
      if (rec.normalizedUrl !== normalizedUrl) continue;
      if (Date.parse(rec.createdAt) < cutoff) continue;
      return rec.id;
    } catch {
      continue;
    }
  }
  return null;
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
