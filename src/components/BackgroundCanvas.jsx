/* ─────────────────────────────────────────────
   BackgroundCanvas — Animated Price Chart Waves
   Abstract wavy lines resembling crypto price
   charts, slowly animated. Clearly visible,
   clearly "finance/crypto", not cyber.
   Constrained to 480px app shell.
   ───────────────────────────────────────────── */
import { useEffect, useRef } from 'react'

/* Multi-harmonic sine wave for organic movement */
function waveY(x, yBase, amp, freq, t, speed) {
  return (
    yBase
    + Math.sin(x * freq + t * speed)           * amp
    + Math.sin(x * freq * 1.7 + t * speed * 0.6) * (amp * 0.4)
    + Math.sin(x * freq * 0.5 + t * speed * 1.4) * (amp * 0.25)
  )
}

const WAVES = [
  {
    yRatio:     0.28,   // vertical position as fraction of H
    amp:        52,
    freq:       0.009,
    speed:      0.007,
    color:      [53,  208, 127],  // green (Celo)
    lineAlpha:  0.4,
    fillAlpha:  0.055,
    lineW:      1.4,
  },
  {
    yRatio:     0.55,
    amp:        38,
    freq:       0.011,
    speed:      0.005,
    color:      [129, 140, 248],  // purple
    lineAlpha:  0.28,
    fillAlpha:  0.04,
    lineW:      1.1,
  },
  {
    yRatio:     0.77,
    amp:        26,
    freq:       0.014,
    speed:      0.009,
    color:      [252, 255, 82 ],  // gold
    lineAlpha:  0.2,
    fillAlpha:  0.025,
    lineW:      0.9,
  },
]

export default function BackgroundCanvas({ theme }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (theme === 'light') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let t = 0

    const W = Math.min(window.innerWidth, 480)
    const H = window.innerHeight
    canvas.width  = W
    canvas.height = H

    const STEP = 3  // px between sample points (smoothness)

    const draw = () => {
      t++
      ctx.clearRect(0, 0, W, H)

      for (const wave of WAVES) {
        const yBase = wave.yRatio * H
        const [r, g, b] = wave.color

        /* ── Build wave path ── */
        const pts = []
        for (let x = 0; x <= W; x += STEP) {
          pts.push({ x, y: waveY(x, yBase, wave.amp, wave.freq, t, wave.speed) })
        }

        /* ── Filled area below wave ── */
        ctx.beginPath()
        ctx.moveTo(0, H)
        for (const p of pts) ctx.lineTo(p.x, p.y)
        ctx.lineTo(W, H)
        ctx.closePath()

        const fillGrad = ctx.createLinearGradient(0, yBase - wave.amp, 0, H)
        fillGrad.addColorStop(0, `rgba(${r},${g},${b},${wave.fillAlpha})`)
        fillGrad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = fillGrad
        ctx.fill()

        /* ── Wave line ── */
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length - 2; i++) {
          // Smooth Catmull–Rom-ish via midpoints
          const mx = (pts[i].x + pts[i + 1].x) / 2
          const my = (pts[i].y + pts[i + 1].y) / 2
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)

        ctx.strokeStyle = `rgba(${r},${g},${b},${wave.lineAlpha})`
        ctx.lineWidth   = wave.lineW
        ctx.lineJoin    = 'round'
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
