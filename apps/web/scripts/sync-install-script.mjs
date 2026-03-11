import { chmod, copyFile, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, "../../..")
const sourcePath = resolve(repoRoot, "install.sh")
const outputPath = resolve(repoRoot, "apps/web/public/install.sh")

await mkdir(dirname(outputPath), { recursive: true })
await copyFile(sourcePath, outputPath)
await chmod(outputPath, 0o755)

console.log(`Synced ${sourcePath} -> ${outputPath}`)
