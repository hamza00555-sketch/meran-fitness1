#!/usr/bin/env node
// ── Publish the pack to Cloudflare R2 ─────────────────────────
//
//   node scripts/upload-r2.mjs [--dir pack] [--prefix ""] [--dry]
//
// Needs, in .env or the environment (.env is gitignored):
//   R2_ACCOUNT_ID       from the Cloudflare dashboard URL
//   R2_ACCESS_KEY_ID    R2 → Manage API tokens → Object Read & Write
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET           e.g. meran-assets
//
// Uses R2's S3 API rather than `wrangler r2 object put` because the
// per-object ContentType and Cache-Control go in the same request,
// and the whole pack uploads concurrently instead of one process per
// file.
//
// ── One-time bucket setup ─────────────────────────────────────
// 1. Attach a custom domain (R2 → Settings → Public access → Custom
//    domain). Do NOT ship the *.r2.dev URL: it is rate-limited and
//    explicitly not for production.
// 2. CORS policy — the app reads the bytes with fetch() to hash them,
//    so it needs real CORS, not just <img> access:
//
//    [{ "AllowedOrigins": ["https://<your-app>.vercel.app", "http://localhost:4173", "http://localhost:5173"],
//       "AllowedMethods": ["GET", "HEAD"],
//       "AllowedHeaders": ["*"],
//       "ExposeHeaders": ["content-length", "etag"],
//       "MaxAgeSeconds": 86400 }]

import { readdir, readFile, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Minimal .env reader — no dependency for four variables.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d }
const DIR    = path.resolve(arg('dir', 'pack'))
const PREFIX = arg('prefix', '')
const DRY    = process.argv.includes('--dry')

const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
const missing = need.filter(k => !process.env[k])
if (missing.length && !DRY) {
  console.error(`✗ missing: ${missing.join(', ')}`)
  console.error('  Put them in .env (already gitignored), or run with --dry to preview.')
  process.exit(1)
}

if (!existsSync(DIR)) {
  console.error(`✗ no pack at ${DIR} — run scripts/build-manifest.mjs first`)
  process.exit(1)
}

const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' }

// Hashed filenames can be cached forever; the manifest is the pointer
// that has to stay fresh, so it gets a short TTL and revalidation.
const cacheFor = (key) =>
  key.endsWith('manifest.json')
    ? 'public, max-age=60, must-revalidate'
    : 'public, max-age=31536000, immutable'

async function walk(dir, base = dir) {
  const out = []
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name)
    if ((await stat(full)).isDirectory()) out.push(...await walk(full, base))
    else out.push({ full, key: PREFIX + path.relative(base, full).split(path.sep).join('/') })
  }
  return out
}

const files = await walk(DIR)
// The manifest goes last, on purpose: until it lands, nothing points
// at the new files, so a failed upload leaves the old pack intact.
files.sort((a, b) => (a.key.endsWith('manifest.json') ? 1 : 0) - (b.key.endsWith('manifest.json') ? 1 : 0))

if (DRY) {
  console.log(`Would upload ${files.length} objects to r2://${process.env.R2_BUCKET || '<bucket>'}/${PREFIX}`)
  for (const f of files.slice(0, 6)) console.log(`  ${f.key}  ${TYPES[path.extname(f.key)] || 'application/octet-stream'}  ${cacheFor(f.key)}`)
  if (files.length > 6) console.log(`  … and ${files.length - 6} more`)
  process.exit(0)
}

let S3Client, PutObjectCommand
try {
  ({ S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3'))
} catch {
  console.error('✗ @aws-sdk/client-s3 is not installed')
  console.error('  npm install -D @aws-sdk/client-s3')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const CONCURRENCY = 8
let done = 0
const failed = []

async function put(file) {
  const body = await readFile(file.full)
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: file.key,
    Body: body,
    ContentType: TYPES[path.extname(file.key)] || 'application/octet-stream',
    CacheControl: cacheFor(file.key),
  }))
  done++
  process.stdout.write(`\r  ${done}/${files.length}`)
}

const manifestFile = files.pop()   // uploaded on its own, after the rest

let cursor = 0
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const i = cursor++
    if (i >= files.length) return
    try { await put(files[i]) } catch (e) { failed.push([files[i].key, e.message]) }
  }
}))

if (failed.length) {
  console.log(`\n✗ ${failed.length} objects failed — manifest NOT published, the old pack still works`)
  for (const [k, m] of failed.slice(0, 10)) console.log(`  ${k}: ${m}`)
  process.exit(1)
}

await put(manifestFile)
console.log(`\n✓ published ${done} objects`)
console.log(`  Clients pick up the new pack within 60s (manifest TTL).`)
