import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parentDirectory = path.dirname(projectRoot)
const electronBinary = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', '.bin', 'electron.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'electron')
const requiredArtifacts = [
  path.join(projectRoot, 'dist', 'index.html'),
  path.join(projectRoot, 'dist-electron', 'main.js'),
  path.join(projectRoot, 'dist-electron', 'preload.cjs')
]

for (const artifact of requiredArtifacts) {
  if (!existsSync(artifact)) {
    throw new Error(`Missing build artifact: ${artifact}. Run npm run build first.`)
  }
}

const child = spawn(electronBinary, [projectRoot], {
  cwd: parentDirectory,
  env: { ...process.env, BETTER_SHOT_SMOKE_TEST: '1' },
  shell: process.platform === 'win32',
  windowsHide: true
})

let output = ''
child.stdout.on('data', (data) => { output += data.toString() })
child.stderr.on('data', (data) => { output += data.toString() })

const timeout = setTimeout(() => {
  child.kill()
  console.error(`[better-shot:smoke] FAIL: Electron timed out\n${output}`)
  process.exit(1)
}, 25_000)

child.on('error', (error) => {
  clearTimeout(timeout)
  console.error(`[better-shot:smoke] FAIL: Could not launch Electron: ${error.message}`)
  process.exit(1)
})

child.on('exit', (code) => {
  clearTimeout(timeout)
  const passed = code === 0 && output.includes('[better-shot:smoke] PASS:')
  if (!passed) {
    console.error(`[better-shot:smoke] FAIL: Electron exited with code ${code}\n${output}`)
    process.exit(1)
  }
  console.log('[better-shot:smoke] PASS: foreign-CWD launch verified')
})
