import React from 'react'
import { createRoot } from 'react-dom/client'
import { PrototypePlayer } from './upstream/src/components/PrototypePlayer.tsx'
import { useStore } from './upstream/src/lib/store.ts'
import './upstream/src/styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Не удалось открыть плеер.')
const root = createRoot(container)

async function openPrototype() {
  const response = await fetch('/canvas.json')
  if (!response.ok) throw new Error('Не удалось загрузить каталог.')
  useStore.getState().setCanvas(await response.json())
  const canvas = useStore.getState().canvas
  const requested = new URLSearchParams(location.search).get('frame')
  const start = canvas?.frames.find(frame => frame.id === requested)?.id ?? canvas?.pages?.[0]?.startFrameId
  if (!start) throw new Error('Не найден стартовый экран каталога.')
  root.render(<PrototypePlayer startFrameId={start} syncUrl />)
}

openPrototype().catch((error: unknown) => {
  root.render(<p>{error instanceof Error ? error.message : 'Не удалось открыть каталог.'}</p>)
})
