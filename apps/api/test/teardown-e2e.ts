/**
 * Removes the isolated media directory created for the e2e run so uploads do
 * not accumulate between runs. Must match the path chosen in `setup-e2e.ts`.
 */
import { rmSync } from "node:fs"
import path from "node:path"

export default function globalTeardown(): void {
  rmSync(path.resolve(__dirname, "..", ".tmp-e2e-media"), { recursive: true, force: true })
}
