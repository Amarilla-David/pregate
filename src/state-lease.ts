import { existsSync, mkdirSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";

function busy(): never {
  throw Object.assign(new Error("Session storage is in use; retry after the hook or cleanup finishes."), { code: "EBUSY" });
}

// Readers announce before checking the exclusive marker again. The cleaner creates that
// marker before checking readers, so either it observes the writer or the writer refuses.
export function withStateWrite<T>(dir: string, write: () => T): T {
  const leases = join(dir, ".leases"), exclusive = join(dir, ".pruning");
  if (existsSync(exclusive)) busy();
  mkdirSync(leases, { recursive: true });
  const lease = join(leases, `${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(lease, JSON.stringify({ pid: process.pid, at: Date.now(), host: hostname() }), { flag: "wx" });
  return writeUnderLease(lease, exclusive, write);
}

function writeUnderLease<T>(lease: string, exclusive: string, write: () => T): T {
  try {
    if (existsSync(exclusive)) busy();
    return write();
  } finally {
    unlinkSync(lease);
  }
}

export function storageActivity(dir: string): { writers: number; pruning: boolean } {
  const leases = join(dir, ".leases");
  return { writers: existsSync(leases) ? readdirSync(leases).length : 0, pruning: existsSync(join(dir, ".pruning")) };
}

export function lockPrune(dir: string): () => void {
  const exclusive = join(dir, ".pruning");
  mkdirSync(exclusive);
  const owner = join(exclusive, `${process.pid}-${crypto.randomUUID()}.json`);
  const release = () => { unlinkSync(owner); rmdirSync(exclusive); };
  return claimPrune(dir, exclusive, owner, release);
}

function claimPrune(dir: string, exclusive: string, owner: string, release: () => void): () => void {
  try {
    writeFileSync(owner, JSON.stringify({ pid: process.pid, at: Date.now(), host: hostname() }), { flag: "wx" });
    if (storageActivity(dir).writers !== 0) busy();
    return release;
  } catch (error) {
    if (existsSync(owner)) unlinkSync(owner);
    rmdirSync(exclusive);
    throw error;
  }
}
