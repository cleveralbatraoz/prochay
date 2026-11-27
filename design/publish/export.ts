import { execFileSync } from 'node:child_process'
import {
  copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

type Manifest = {
  frames: { frameId: string }[]
  generated?: { frames: Record<string, string> }
  nativeStartFrameId: string
}

type Frame = { id: string; name: string; width: number; height: number; html: string }
type Component = { id: string; name: string; template: string; css: string; head: unknown[] }
type Token = { name: string; type: string; value: string; order: number }
type Canvas = {
  id: string
  frames: Frame[]
  components: Component[]
  tokens?: Token[]
  tokenThemes?: string[]
}

const design = join(import.meta.dirname, '../doop')
const asset = /\/a\/([\w-]+\.(?:avif|gif|jpe?g|png|svg|webp))(?=["'\s)<>]|$)/g

async function download(url: URL, headers?: Record<string, string>) {
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url.pathname}`)
  return response
}

async function exportCanvas(output: string, cookie: string) {
  const config: { canvas: string; server: string } = JSON.parse(readFileSync(join(design, '.doop/config.json'), 'utf8'))
  const url = new URL(config.server)
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('The Doop session cookie may only be sent to a loopback server')
  }
  const response = await download(new URL('/api/canvases/' + encodeURIComponent(config.canvas), url), {
    Cookie: cookie, 'x-doop-composes-frames': '1',
  })
  const source: Canvas = await response.json()
  if (source.id !== config.canvas) throw new Error('Unexpected source canvas')

  const manifest: Manifest = JSON.parse(readFileSync(join(design, 'prototype.json'), 'utf8'))
  const selected = [...manifest.frames.map(frame => frame.frameId), ...Object.values(manifest.generated?.frames ?? {})]
  const selectedIds = new Set(selected)
  const start = manifest.nativeStartFrameId
  if (selectedIds.size !== selected.length || !selectedIds.has(start)) throw new Error('Invalid frame selection')

  const media = new Set<string>()
  function localAssets(markup: string) {
    const relative = markup.replaceAll(url.origin + '/a/', '/a/')
    if (/(?:https?:)?\/\/(?!www\.w3\.org\/)/.test(relative)) throw new Error('Unbundled external URL in design')
    return relative.replace(asset, (_, filename: string) => {
      media.add(filename)
      return '/media/' + filename
    })
  }

  const byId = new Map(source.frames.map(frame => [frame.id, frame]))
  const frames = selected.map((id, index) => {
    const frame = byId.get(id)
    if (!frame) throw new Error('Missing frame in source canvas: ' + id)
    const html = localAssets(frame.html)
    if (/<(?:script|iframe|object|embed)\b/i.test(html)) throw new Error('Unexpected executable content in ' + id)
    for (const [, target] of html.matchAll(/data-doop-action="navigate:([^"]+)"/g)) {
      if (!selectedIds.has(target)) throw new Error('Unpublished navigation destination in ' + id)
    }
    return {
      id, canvasId: 'prochay', pageId: 'demo', name: frame.name,
      x: index * 420, y: 0, width: frame.width, height: frame.height, createdAt: 0, updatedAt: 1, html,
    }
  })
  const components = source.components.map(({ id, name, template, css, head }) => {
    if (head.length) throw new Error('Review external component head before publishing')
    return { id, name, template: localAssets(template), css: localAssets(css), head: [] }
  })
  const tokens = (source.tokens ?? []).map(({ name, type, value, order }) => ({ name, type, value, order }))
  const canvas = {
    id: 'prochay', name: 'ПРОЧАЙ', role: 'view', pages: [{ id: 'demo', name: 'ПРОЧАЙ', startFrameId: start }],
    frames, components, tokens, tokenThemes: source.tokenThemes ?? [],
  }

  mkdirSync(join(output, 'media'))
  for (const name of media) {
    const photo = await download(new URL('/a/' + name, url))
    if (!photo.headers.get('content-type')?.startsWith('image/')) throw new Error('Unexpected image content for ' + name)
    writeFileSync(join(output, 'media', name), Buffer.from(await photo.arrayBuffer()))
  }
  writeFileSync(join(output, 'canvas.json'), JSON.stringify(canvas))
  return { screens: frames.length, images: media.size }
}

function copyPlayer(output: string, player: string) {
  const dist = join(player, 'dist')
  cpSync(join(dist, 'assets'), join(output, 'assets'), { recursive: true })
  const route = join(output, 'c/prochay/proto')
  mkdirSync(route, { recursive: true })
  for (const directory of [output, route]) copyFileSync(join(dist, 'index.html'), join(directory, 'index.html'))

  const source = join(output, 'source')
  mkdirSync(source)
  const modules = join(player, 'node_modules')
  copyFileSync(join(modules, 'doop/LICENSE'), join(source, 'LICENSE.txt'))
  copyFileSync(join(dist, 'licenses.txt'), join(source, 'third-party.txt'))
  execFileSync('tar', [
    '--no-xattrs', '-czf', join(source, 'player-source.tar.gz'), '-C', player,
    'entry.tsx', 'index.html', 'styles.css', 'vite.config.mts', 'package.json', 'bun.lock',
    '-C', modules, 'doop/LICENSE', 'doop/src', 'doop/shared', 'doop/tsconfig.json', 'doop/package.json', 'doop/bun.lock',
  ], { env: { ...process.env, COPYFILE_DISABLE: '1' } })
  writeFileSync(join(source, 'index.html'), `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Плеер Doop</title>
<h1>Плеер Doop</h1><p><a href="LICENSE.txt">GNU AGPL 3.0</a></p>
<p><a href="third-party.txt">Лицензии зависимостей</a></p>
<p><a href="https://github.com/doop-design/doop">Doop</a></p>
<p><a href="player-source.tar.gz">Исходный код плеера и сборки</a></p>
<p>В распакованном каталоге выполните <code>bun install --frozen-lockfile &amp;&amp; bun run build</code>.</p></html>`)
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { player: { type: 'string' }, 'cookie-file': { type: 'string' }, help: { type: 'boolean', short: 'h' } },
  })
  const usage = 'Usage: node export.ts OUTPUT [--player DIRECTORY] [--cookie-file FILE]'
  if (values.help) return console.log(usage)
  if (positionals.length !== 1) throw new Error(usage)
  const cookie = values['cookie-file'] ? readFileSync(values['cookie-file'], 'utf8').trim() : process.env.DOOP_COOKIE
  if (!cookie) throw new Error('Provide --cookie-file or DOOP_COOKIE')

  const output = resolve(positionals[0])
  if (existsSync(output) && readdirSync(output).length) throw new Error('Choose an empty output directory')
  mkdirSync(dirname(output), { recursive: true })
  const staging = mkdtempSync(join(dirname(output), '.prochay-export-'))
  try {
    const { screens, images } = await exportCanvas(staging, cookie)
    copyPlayer(staging, values.player ? resolve(values.player) : join(import.meta.dirname, 'player'))
    renameSync(staging, output)
    console.log(`${screens} screens, ${images} images`)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exitCode = 1
})
