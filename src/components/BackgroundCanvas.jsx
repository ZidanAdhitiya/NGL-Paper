/* ─────────────────────────────────────────────
   BackgroundCanvas — Floating Hexagons
   Slowly drifting hexagons, brand colors,
   low opacity. Celo brand + blockchain aesthetic.
   Constrained to 480px app shell.
   ───────────────────────────────────────────── */
import { useEffect, useRef } from 'react'

const COLORS = [
  { r: 129, g: 140, b: 248 }, // purple
  { r: 53,  g: 208, b: 127 }, // green (Celo)
  { r: 252, g: 255, b: 82  }, // gold
]

function drawHex(ctx, x, y, size, angle) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a  = (i * Math.PI) / 3 + angle
    const px = x + size * Math.cos(a)
    const py = y + size * Math.sin(a)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export default function BackgroundCanvas({ theme }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (theme === 'light') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const W = Math.min(window.innerWidth, 480)
    const H = window.innerHeight
    canvas.width  = W
    canvas.height = H

    /* ── Generate hexagons ── */
    const hexagons = Array.from({ length: 22 }, () => {
      const col = COLORS[Math.floor(Math.random() * COLORS.length)]
      return {
        x:      Math.random() * W,
        y:      Math.random() * H,
        size:   12 + Math.random() * 30,
        rot:    Math.random() * Math.PI * 2,
        drot:   (Math.random() - 0.5) * 0.004,  // very slow spin
        vy:    -(0.12 + Math.random() * 0.22),   // drift upward
        vx:     (Math.random() - 0.5) * 0.08,
        filled: Math.random() < 0.25,            // 25% filled, 75% outline
        col,
        alpha:  0.07 + Math.random() * 0.13,     // 7–20% opacity
      }
    })

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      for (const h of hexagons) {
        h.x   += h.vx
        h.y   += h.vy
        h.rot += h.drot

        /* Wrap: if off top → reset to bottom */
        if (h.y + h.size < 0)   h.y = H + h.size
        if (h.x < -h.size)      h.x = W + h.size
        if (h.x > W + h.size)   h.x = -h.size

        const { r, g, b } = h.col

        drawHex(ctx, h.x, h.y, h.size, h.rot)

        if (h.filled) {
          ctx.fillStyle = `rgba(${r},${g},${b},${(h.alpha * 0.35).toFixed(3)})`
          ctx.fill()
        }

        ctx.strokeStyle = `rgba(${r},${g},${b},${h.alpha.toFixed(3)})`
        ctx.lineWidth   = 0.9
        ctx.stroke()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [theme])

  if (theme === 'light') return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          '50%',
        transform:     'translateX(-50%)',
        pointerEvents: 'none',
        zIndex:        0,
      }}
    />
  )
}
