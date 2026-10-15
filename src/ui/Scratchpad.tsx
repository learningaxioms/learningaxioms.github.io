import { useEffect, useRef, useState } from 'react'

/** A pencil-and-paper area for working things out. Nothing is graded here. */
export function Scratchpad() {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)
  const [erase, setErase] = useState(false)

  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    const r = c.getBoundingClientRect()
    c.width = r.width * dpr
    c.height = r.height * dpr
    c.getContext('2d')!.scale(dpr, dpr)
  }, [])

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const line = (to: [number, number]) => {
    const ctx = ref.current!.getContext('2d')!
    const from = last.current ?? to
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--blue') || '#2B59C3'
    ctx.lineWidth = erase ? 22 : 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(...from)
    ctx.lineTo(...to)
    ctx.stroke()
    last.current = to
  }

  return (
    <div className="scratch">
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          drawing.current = true
          ;(e.target as Element).setPointerCapture(e.pointerId)
          last.current = pos(e)
          line(pos(e))
        }}
        onPointerMove={(e) => drawing.current && line(pos(e))}
        onPointerUp={() => {
          drawing.current = false
          last.current = null
        }}
      />
      <div className="scratch-tools">
        <button className={!erase ? 'on' : ''} onClick={() => setErase(false)}>pencil</button>
        <button className={erase ? 'on' : ''} onClick={() => setErase(true)}>eraser</button>
        <button
          onClick={() => {
            const c = ref.current!
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
          }}
        >
          clear
        </button>
      </div>
    </div>
  )
}
