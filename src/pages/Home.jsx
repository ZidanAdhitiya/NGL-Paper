/* ─────────────────────────────────────────────
   Home Page — NGL Paper
   Notion-inspired layout:
   Visual zone (path + chips) → Hero → CTAs →
   Visual zone → Trust bar
   ───────────────────────────────────────────── */

/* ── SVG Icons ─────────────────────────────── */
const IconDoc = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
)
const IconChat = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconWallet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
    <circle cx="17" cy="15" r="1" fill="currentColor" stroke="none"/>
  </svg>
)
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

/* ── Floating crypto chip ───────────────────── */
function Chip({ variant = 'purple', badge, style, children }) {
  return (
    <div className={`nv-chip nv-chip--${variant}`} style={style}>
      {children}
      {badge && <span className="nv-chip-badge">{badge}</span>}
    </div>
  )
}

/* ── Sparkle decoration ─────────────────────── */
const Spark = ({ style }) => <span className="nv-spark" style={style} aria-hidden="true">✦</span>

/* ── Top path SVG ───────────────────────────── */
const TopPath = () => (
  <svg className="nv-path-svg" viewBox="0 0 480 200" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="pg1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stopColor="#35D07F" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#818CF8" stopOpacity="0.9"/>
      </linearGradient>
      <filter id="glow1"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path className="nv-path-trace" d="M 20 150 C 80 100, 180 40, 290 55 C 370 65, 420 110, 460 80" stroke="url(#pg1)" strokeWidth="1.8" fill="none" filter="url(#glow1)"/>
  </svg>
)

/* ── Bottom path SVG ────────────────────────── */
const BotPath = () => (
  <svg className="nv-path-svg" viewBox="0 0 480 180" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="pg2" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%"   stopColor="#818CF8" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#FCFF52" stopOpacity="0.7"/>
      </linearGradient>
      <filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path className="nv-path-trace nv-path-trace--delay" d="M 460 40 C 380 80, 260 40, 160 90 C 80 130, 40 110, 20 150" stroke="url(#pg2)" strokeWidth="1.8" fill="none" filter="url(#glow2)"/>
  </svg>
)

/* ═══════════════════════════════════════════ */
export default function Home({
  address, balance, network,
  connectWallet, disconnectWallet,
  setView, shortenAddr, theme, toggleTheme, totalPoints
}) {
  return (
    <div className="page nv-page">

      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="h-logo-mark">N</div>
          <span className="logo-name">NGL Paper</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {totalPoints > 0 && (
            <button
              className="wallet-chip"
              onClick={() => setView('profile')}
              style={{ gap: '0.3rem', background: 'var(--gold-dim)', borderColor: 'rgba(252,255,82,0.3)', color: 'var(--gold)' }}
            >
              <span style={{ fontSize: '0.7rem' }}>⭐</span>
              <span style={{ fontWeight: 800 }}>{totalPoints}</span>
            </button>
          )}
          <button className="h-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          {address ? (
            <button className="wallet-chip" onClick={disconnectWallet}>
              <span className="wallet-dot" />{shortenAddr(address)}
            </button>
          ) : (
            <button className="wallet-chip" onClick={connectWallet}>
              <span className="wallet-dot off" />Connect
            </button>
          )}
        </div>
      </div>

      {/* ══ TOP VISUAL ZONE ══ */}
      <div className="nv-zone nv-zone--top">
        <TopPath />

        {/* Floating chips */}
        <Chip variant="gold" style={{ left: '7%', top: '32%' }}>
          <IconDoc />
        </Chip>

        <Chip variant="green" badge="✓" style={{ right: '12%', top: '14%' }}>
          <span className="nv-chip-letter">₡</span>
        </Chip>

        <Chip variant="purple" style={{ right: '8%', bottom: '12%' }}>
          <IconChat />
        </Chip>

        {/* Sparkles */}
        <Spark style={{ left: '48%', top: '10%' }} />
        <Spark style={{ left: '22%', bottom: '20%' }} />
        <Spark style={{ right: '34%', top: '55%' }} />
      </div>

      {/* ══ HERO ══ */}
      <div className="nv-hero">
        <h1 className="nv-title">
          Blockchain jargon,<br />
          <span className="nv-title-accent">finally explained.</span>
        </h1>
        <p className="nv-sub">
          NGL Paper turns dense whitepapers and cryptic docs into clear, structured breakdowns — so you understand what you're reading before you invest or build.
        </p>
      </div>

      {/* ══ CTA BUTTONS ══ */}
      <div className="nv-cta-group">
        <button id="btn-feat-whitepaper" className="nv-btn-primary" onClick={() => setView('whitepaper')}>
          Explain a Whitepaper
        </button>
        <button id="btn-feat-askpaper" className="nv-btn-secondary" onClick={() => setView('askpaper')}>
          Ask the Paper
        </button>
      </div>

      {/* ══ BOTTOM VISUAL ZONE ══ */}
      <div className="nv-zone nv-zone--bot">
        <BotPath />

        <Chip variant="purple" style={{ left: '8%', top: '18%' }}>
          <IconChat />
        </Chip>

        <Chip variant="blue" badge="AI" style={{ right: '10%', top: '12%' }}>
          <span className="nv-chip-letter">G</span>
        </Chip>

        <Chip variant="dark" style={{ left: '40%', bottom: '18%' }}>
          <IconWallet />
        </Chip>

        <Spark style={{ right: '38%', top: '40%' }} />
        <Spark style={{ left: '62%', bottom: '28%' }} />
      </div>

      {/* ══ FOOTER ══ */}
      <div className="nv-footer">
        <span className="nv-footer-dot" />
        <span className="nv-footer-text">Live on Celo</span>
      </div>


    </div>
  )
}
