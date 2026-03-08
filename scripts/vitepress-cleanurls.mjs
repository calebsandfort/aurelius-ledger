/**
 * Converts VitePress's flat .html output into directory-based clean URLs.
 * e.g. getting-started/setup.html → getting-started/setup/index.html
 *
 * This lets Next.js serve every page as a directory index with no custom routing.
 *
 * Usage: node scripts/vitepress-cleanurls.mjs <output-dir>
 */
import { readdir, rename, mkdir } from 'fs/promises'
import { join, basename } from 'path'

const SKIP = new Set(['index.html', '404.html'])

async function processDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await processDir(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.html') && !SKIP.has(entry.name)) {
      const pageName = basename(entry.name, '.html')
      const targetDir = join(dir, pageName)
      await mkdir(targetDir, { recursive: true })
      await rename(fullPath, join(targetDir, 'index.html'))
    }
  }
}

const dir = process.argv[2]
if (!dir) {
  console.error('Usage: node scripts/vitepress-cleanurls.mjs <output-dir>')
  process.exit(1)
}

await processDir(dir)
console.log(`cleanurls: converted .html files in ${dir}`)
