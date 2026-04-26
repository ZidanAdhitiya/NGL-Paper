/* ─────────────────────────────────────────────
   Home Page — NGL Paper
   ───────────────────────────────────────────── */

export default function Home({ address, balance, network, connectWallet, disconnectWallet, setView, shortenAddr, theme, toggleTheme }) {
  return (
    <div className="page">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="logo-badge">📜</div>
          <span className="logo-name">NGL Paper</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={toggleTheme}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '999px', width: 30, height: 30, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {address ? (
            <button className="wallet-chip" onClick={disconnectWallet} title="Disconnect wallet" style={{ cursor: 'pointer' }}>
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
        <section className="hero-section fade-up">
          <p className="hero-eyebrow">⚡ Built on Celo · MiniPay</p>
          <h1 className="hero-title">
            Blockchain jargon,<br />
            <span>finally explained.</span>
          </h1>
          <p className="hero-sub">
            NGL Paper turns dense whitepapers and cryptic blockchain documents into clear, structured explanations — so you understand what you're actually reading before you invest or build.
          </p>
        </section>

        {/* ── Wallet state ── */}
        {!address ? (
          <button
            onClick={connectWallet}
            style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', width: '100%', padding: '0.9rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.2s', textAlign: 'left' }}
            className="fade-up delay-1"
          >
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>👛</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text)' }}>Connect your wallet to get started</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>MiniPay required · pay $0.01 per page explained</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>›</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.85rem' }} className="fade-up delay-1">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green-dim)', border: '1px solid rgba(53,208,127,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>👛</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Connected · {network}</div>
              <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: '0.1rem' }}>{shortenAddr(address)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Balance</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--gold)' }}>{balance}</div>
              </div>
              <button onClick={disconnectWallet} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.15rem 0.55rem', cursor: 'pointer', fontFamily: 'var(--font)' }}>Disconnect</button>
            </div>
          </div>
        )}

        {/* ── Features ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Explain Paper */}
          <div className="feature-card gold fade-up delay-2" onClick={() => setView('whitepaper')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
              <div className="feature-icon-wrap gold">📄</div>
              <div style={{ flex: 1 }}>
                <span className="feature-tag gold">$0.01 / page</span>
                <h2 className="feature-title" style={{ marginTop: '0.4rem' }}>Explain Whitepaper</h2>
                <p className="feature-desc">
                  Upload a PDF or paste a URL — our AI reads the entire document and returns a structured breakdown with plain-language summaries, key terms defined with analogies, and a clear core takeaway for every section.
                </p>
              </div>
              <span className="feature-arrow">›</span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['PDF upload', 'URL import', 'Overview or Full Analysis', 'Download PDF'].map(t => (
                <span key={t} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.18rem 0.55rem', borderRadius: '999px', border: '1px solid var(--border)' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Ask the Paper */}
          <div className="feature-card purple fade-up delay-3" onClick={() => setView('askpaper')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
              <div className="feature-icon-wrap purple">💬</div>
              <div style={{ flex: 1 }}>
                <span className="feature-tag purple">Free · AI Chat</span>
                <h2 className="feature-title" style={{ marginTop: '0.4rem' }}>Ask the Paper</h2>
                <p className="feature-desc">
                  Attach any whitepaper and ask questions in plain language — "What are the risks?", "How does the token work?", "Explain the consensus mechanism." Get instant, accurate answers grounded in the actual document.
                </p>
              </div>
              <span className="feature-arrow">›</span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['What are the risks?', 'How does tokenomics work?', 'Explain the consensus'].map(t => (
                <span key={t} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.18rem 0.55rem', borderRadius: '999px', border: '1px solid var(--border)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── How it works ── */}
        <div style={{ paddingTop: '0.25rem' }} className="fade-up delay-4">
          <p className="section-label" style={{ marginBottom: '1rem' }}>How it works</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { n: '01', title: 'Upload your document', sub: 'Drop a PDF or paste any URL — whitepaper, research paper, docs page, whatever you need explained.' },
              { n: '02', title: 'Pay as you go', sub: 'You only pay for what you use. $0.01 USD per page, settled instantly on-chain through MiniPay.' },
              { n: '03', title: 'Read the explanation', sub: 'Every section is broken down with a plain summary, technical deep-dive, key term definitions, and a core takeaway.' },
            ].map(({ n, title, sub }, i) => (
              <div key={n} style={{ display: 'flex', gap: '1rem', paddingBottom: i < 2 ? '1rem' : 0, marginBottom: i < 2 ? '1rem' : 0, borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--text-muted)', paddingTop: '0.1rem', flexShrink: 0, minWidth: 20 }}>{n}</span>
                <div>
                  <div style={{ fontSize: '0.87rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>{title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Built on ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap', paddingBottom: '0.5rem' }} className="fade-up delay-5">
          {['Celo Network', 'MiniPay', 'Vertex AI', 'ODIS'].map(tag => (
            <span key={tag} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', borderRadius: '999px' }}>{tag}</span>
          ))}
        </div>

      </div>
    </div>
  )
}
