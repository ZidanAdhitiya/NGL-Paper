/* ─────────────────────────────────────────────
   Home Page — NGL Paper (Redesigned)
   Editorial dark aesthetic · SVG icons · Typography-driven
   ───────────────────────────────────────────── */

const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/>
    <line x1="8" y1="9" x2="10" y2="9"/>
  </svg>
)

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

const IconWallet = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M2 10h20"/>
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

export default function Home({ address, balance, network, connectWallet, disconnectWallet, setView, shortenAddr, theme, toggleTheme }) {
  return (
    <div className="page">

      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="h-logo-mark">N</div>
          <span className="logo-name">NGL Paper</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="h-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          {address ? (
            <button className="wallet-chip" onClick={disconnectWallet} title="Disconnect wallet">
              <span className="wallet-dot" />
              {shortenAddr(address)}
            </button>
          ) : (
            <button className="wallet-chip" onClick={connectWallet}>
              <span className="wallet-dot off" />
              Connect
            </button>
          )}
        </div>
      </div>

      <div className="page-content">

        {/* ── Hero ── */}
        <section className="h-hero fade-up">
          <div className="h-eyebrow">
            <span className="h-eyebrow-pip" />
            Built on Celo · MiniPay
          </div>
          <h1 className="h-title">
            Blockchain jargon,<br />
            <span className="h-title-accent">finally explained.</span>
          </h1>
          <p className="h-sub">
            NGL Paper turns dense whitepapers into clear, structured breakdowns — so you understand what you're reading before you invest or build.
          </p>
        </section>

        {/* ── Wallet state ── */}
        {!address ? (
          <button className="h-wallet-cta fade-up delay-1" onClick={connectWallet} id="btn-connect-wallet">
            <div className="h-wallet-cta-icon">
              <IconWallet />
            </div>
            <div className="h-wallet-cta-body">
              <span className="h-wallet-cta-label">Connect your wallet to start</span>
              <span className="h-wallet-cta-sub">MiniPay required · $0.01 per page explained</span>
            </div>
            <span className="h-wallet-cta-arrow"><IconArrow /></span>
          </button>
        ) : (
          <div className="h-wallet-card fade-up delay-1">
            <div className="h-wallet-card-top">
              <div className="h-wallet-status-row">
                <span className="wallet-dot" />
                <span className="h-wallet-net">{network}</span>
              </div>
              <button className="h-wallet-disc-btn" onClick={disconnectWallet}>Disconnect</button>
            </div>
            <div className="h-wallet-card-mid">
              <span className="h-wallet-addr">{shortenAddr(address)}</span>
              <span className="h-wallet-bal">{balance} <em className="h-wallet-unit">CELO</em></span>
            </div>
          </div>
        )}

        {/* ── Features ── */}
        <div className="h-features fade-up delay-2">

          {/* 01 — Explain Whitepaper */}
          <button className="h-feat" id="btn-feat-whitepaper" onClick={() => setView('whitepaper')}>
            <div className="h-feat-top">
              <span className="h-feat-num">01</span>
              <div className="h-feat-icon-wrap h-feat-icon-wrap--gold">
                <IconDoc />
              </div>
              <span className="h-feat-badge h-feat-badge--gold">$0.01 / page</span>
              <span className="h-feat-arrow"><IconArrow /></span>
            </div>
            <div className="h-feat-body">
              <p className="h-feat-title">Explain Whitepaper</p>
              <p className="h-feat-desc">Upload a PDF or paste a URL. Get a structured breakdown — plain summaries, key terms with analogies, and a core takeaway for every section.</p>
            </div>
            <div className="h-feat-tags">
              {['PDF upload', 'URL import', 'Overview / Full Analysis', 'Download PDF'].map(t => (
                <span key={t} className="h-feat-tag">{t}</span>
              ))}
            </div>
          </button>

          <div className="h-feat-sep" />

          {/* 02 — Ask the Paper */}
          <button className="h-feat" id="btn-feat-askpaper" onClick={() => setView('askpaper')}>
            <div className="h-feat-top">
              <span className="h-feat-num">02</span>
              <div className="h-feat-icon-wrap h-feat-icon-wrap--purple">
                <IconChat />
              </div>
              <span className="h-feat-badge h-feat-badge--purple">Free · AI Chat</span>
              <span className="h-feat-arrow"><IconArrow /></span>
            </div>
            <div className="h-feat-body">
              <p className="h-feat-title">Ask the Paper</p>
              <p className="h-feat-desc">Attach any whitepaper and ask in plain language — "What are the risks?", "How does the token work?" Instant answers grounded in the actual document.</p>
            </div>
            <div className="h-feat-tags">
              {['What are the risks?', 'How does tokenomics work?', 'Explain the consensus'].map(t => (
                <span key={t} className="h-feat-tag h-feat-tag--purple">{t}</span>
              ))}
            </div>
          </button>

        </div>

        {/* ── How it works ── */}
        <div className="h-steps fade-up delay-3">
          <p className="section-label" style={{ marginBottom: '1.1rem' }}>How it works</p>
          <div className="h-steps-list">
            {[
              { n: '01', title: 'Upload your document', sub: 'Drop a PDF or paste any URL — whitepaper, research paper, docs page.' },
              { n: '02', title: 'Pay as you go', sub: '$0.01 per page, settled instantly on-chain via MiniPay.' },
              { n: '03', title: 'Read the explanation', sub: 'Plain summary, technical deep-dive, key terms, and a core takeaway per section.' },
            ].map(({ n, title, sub }, i) => (
              <div key={n} className="h-step">
                <div className="h-step-left">
                  <span className="h-step-num">{n}</span>
                  {i < 2 && <div className="h-step-line" />}
                </div>
                <div className="h-step-body">
                  <p className="h-step-title">{title}</p>
                  <p className="h-step-sub">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Built on ── */}
        <div className="h-built fade-up delay-4">
          {['Celo Network', 'MiniPay', 'Vertex AI', 'Gemini 2.5 Flash'].map(tag => (
            <span key={tag} className="h-built-tag">{tag}</span>
          ))}
        </div>

      </div>
    </div>
  )
}
