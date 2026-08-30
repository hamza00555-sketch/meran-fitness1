#!/usr/bin/env node
// ── Turn generated clips into pack-ready loops ────────────────
//
//   node scripts/loop-video.mjs <in-dir> <out-dir>
//
// The generator was given the same frame as start and end, so the loop
// is structural — nothing to splice. What this pass owns is delivery:
// a short crossfade of the tail over the head to hide any residual
// first/last-frame drift, H.264 at a size a workout screen actually
// needs, no audio track, and +faststart so playback begins before the
// download ends. Requires ffmpeg (apt-get install -y ffmpeg).

import { readdir, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const [IN, OUT] = process.argv.slice(2)
if (!IN || !OUT) { console.error('usage: loop-video.mjs <in-dir> <out-dir>'); process.exit(1) }

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) }
catch { console.error('ffmpeg not found — apt-get install -y ffmpeg'); process.exit(1) }

await mkdir(OUT, { recursive: true })
const files = (await readdir(IN)).filter(f => /\.mp4$/i.test(f))

const FADE = 0.25          // seconds of tail blended over the head
for (const f of files.sort()) {
  const src = path.join(IN, f)
  const dst = path.join(OUT, f)
  // Duration probe, so the crossfade window lands on the real tail.
  const dur = parseFloat(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src,
  ]).toString())
  const body = Math.max(0.5, dur - FADE)
  execFileSync('ffmpeg', ['-y', '-v', 'error',
    '-i', src,
    // head = everything but the tail; tail fades over the very start,
    // so frame N-ε and frame 0 can never disagree visibly.
    '-filter_complex',
    `[0:v]trim=0:${body},setpts=PTS-STARTPTS[head];` +
    `[0:v]trim=${body},setpts=PTS-STARTPTS[tail];` +
    `[head][tail]xfade=transition=fade:duration=${FADE}:offset=${(body - FADE).toFixed(3)},` +
    `scale=768:-2,fps=24[v]`,
    '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    dst,
  ])
  console.log('✓', f)
}
console.log(`\n${files.length} loops → ${OUT}`)
