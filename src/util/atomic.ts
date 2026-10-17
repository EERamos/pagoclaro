import { copyFileSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Write-then-rename, so a reader never sees half a file. On Windows an antivirus or the search
 * indexer can hold the target for a moment (EPERM/EBUSY): retry, then fall back to copy.
 */
export function atomicWrite(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw e;
      pause(15 * (attempt + 1));
    }
  }
  copyFileSync(tmp, file);
  try {
    unlinkSync(tmp);
  } catch {
    // A leftover temp file is harmless.
  }
}
