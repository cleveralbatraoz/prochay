import { execFileSync } from 'node:child_process'
import { mkdtempDisposable } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from 'vite'

const { values } = parseArgs({ options: { review: { type: 'string' } } })
if (values.review !== undefined && !/^[1-9]\d*$/.test(values.review)) {
  throw new Error('Параметр --review принимает номер PR')
}

const destination = '/srv/prochay-demo/current' + (values.review ? `/c/review-${values.review}/proto/` : '/')
await using output = await mkdtempDisposable(join(tmpdir(), 'prochay-demo-'))
await build({ root: resolve(import.meta.dirname, '..'), build: { outDir: output.path, emptyOutDir: true } })
execFileSync('rclone', [
  'sync', output.path, ':sftp:' + destination,
  ...(values.review ? [] : ['--exclude', '/c/review-*/**']),
  '--config', '',
  '--sftp-ssh', 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes vpn',
  '--sftp-known-hosts-file', '~/.ssh/known_hosts',
  '--sftp-shell-type', 'none', '--ignore-times',
], { stdio: 'inherit' })
