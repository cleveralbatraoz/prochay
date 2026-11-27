import React from 'react'
import { createRoot } from 'react-dom/client'
import { PrototypePlayer } from './upstream/src/components/PrototypePlayer.tsx'
import { useStore } from './upstream/src/lib/store.ts'
import './upstream/src/styles.css'

const root = createRoot(document.getElementById('root'))

async function openPrototype() {
  const response = await fetch('/canvas.json')
  if (!response.ok) throw new Error('Не удалось загрузить каталог.')
  const canvas = await response.json()
  useStore.getState().setCanvas(canvas)
  const requested = new URLSearchParams(location.search).get('frame')
  const start = canvas.frames.some(frame => frame.id === requested) ? requested : canvas.pages[0].startFrameId
  root.render(<PrototypePlayer startFrameId={start} syncUrl />)
}

openPrototype().catch(error => root.render(<p>{error.message}</p>))
