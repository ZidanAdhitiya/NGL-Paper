/* ─────────────────────────────────────────────
   Profile Page — NGL Paper
   Wallet-based account: history, stats, preferences
   ───────────────────────────────────────────── */
import { useState, useEffect } from 'react'
import { MISSIONS, getMissionState, getMissionCount } from '../utils/points'

const BACKEND = import.meta.env.VITE_BACKEND_URL || window.__BACKEND_URL__ || ''

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Profile({ address, balance, network, connectWallet, showToast, shortenAddr, theme, toggleTheme, totalPoints }) {
  const [account,  setAccount]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [prefMode, setPrefMode] = useState('simply')
  const [prefLang, setPrefLang] = useState('auto')
  const [saving,   setSaving]   = useState(false)
  const [missionState, setMissionState] = useState(() => getMissionState())

  useEffect(() => {
    if (address) fetchAccount()
  }, [address]) // eslint-disable-line

  // Refresh mission state whenever points change
  useEffect(() => {
    setMissionState(getMissionState())
  }, [totalPoints])

  const fetchAccount = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${BACKEND}/api/account/${address}`)
      const data = await res.json()
      if (res.ok) {
        setAccount(data)
        setPrefMode(data.default_mode || 'simply')
        setPrefLang(data.default_lang  || 'auto')
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      await fetch(`${BACKEND}/api/account/${address}/preferences`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ default_mode: prefMode, default_lang: prefLang }),
      })
      showToast('Preferences saved ✓', 'success')
    } catch {
      showToast('Failed to save', 'error')
    } finally { setSaving(false) }
  }

  const ThemeBtn = () => (
    <button onClick={toggleTheme} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '999px', width: 30, height: 30, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )

  /* ── Not connected ── */
  if (!address) {
    return (
      <div className="page">
        <div className="topbar">
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Account</span>
          <ThemeBtn />
        </div>
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '2.5rem' }}>👛</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Connect your wallet</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 260 }}>
            Link your MiniPay wallet to track your explained papers, total pages, spending history, and set default preferences.
          </div>
          <button className="btn btn-primary" style={{ width: 'auto', paddingInline: '2rem', marginTop: '0.5rem' }} onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  /* ── Connected ── */
  return (
    <div className="page">
      <div className="topbar">
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Account</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeBtn />
          <span className="feature-tag green" style={{ fontSize: '0.68rem' }}>Connected</span>
        </div>
      </div>

      <div className="page-content">

        {/* ── Wallet header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }} className="fade-up">
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-dim)', border: '1px solid rgba(53,208,127,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>👛</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{network}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: '0.1rem' }}>{shortenAddr(address)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Balance</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--gold)' }}>{balance} CELO</div>
          </div>
        </div>

        {/* ── Stats ── */}
        {account && (
          <div style={{ display: 'flex', gap: '0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '0.75rem 0' }} className="fade-up delay-1">
            {[
              { label: 'Papers explained', val: account.stats.total_papers, color: 'var(--gold)' },
              { label: 'Total pages', val: account.stats.total_pages, color: 'var(--text)' },
              { label: 'Member since', val: formatDate(account.created_at), color: 'var(--green)', small: true },
            ].map(({ label, val, color, small }, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: small ? '0.72rem' : '1.1rem', fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Preferences ── */}
        <div className="fade-up delay-2">
          <p className="section-label" style={{ marginBottom: '0.85rem' }}>Default Preferences</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Explain Mode</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[{ id: 'simply', label: 'Overview', desc: 'Key points & summary' }, { id: 'full', label: 'Full Analysis', desc: 'Every detail explained' }].map(m => (
                  <button key={m.id} onClick={() => setPrefMode(m.id)} style={{
                    flex: 1, padding: '0.65rem 0.6rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font)', transition: 'all 0.2s',
                    border: `1.5px solid ${prefMode === m.id ? 'var(--purple)' : 'var(--border)'}`,
                    background: prefMode === m.id ? 'var(--purple-dim)' : 'transparent',
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: prefMode === m.id ? 'var(--purple)' : 'var(--text)', marginBottom: '0.1rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Output Language</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[{ id: 'auto', label: 'Auto' }, { id: 'english', label: 'English' }, { id: 'indonesian', label: 'Indonesian' }].map(l => (
                  <button key={l.id} onClick={() => setPrefLang(l.id)} style={{
                    flex: 1, padding: '0.4rem 0.25rem', borderRadius: '999px', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: '0.75rem', transition: 'all 0.2s',
                    border: `1px solid ${prefLang === l.id ? 'var(--purple)' : 'var(--border)'}`,
                    background: prefLang === l.id ? 'var(--purple-dim)' : 'transparent',
                    color: prefLang === l.id ? 'var(--purple)' : 'var(--text-muted)',
                    fontWeight: prefLang === l.id ? 600 : 400,
                  }}>{l.label}</button>
                ))}
              </div>
            </div>

            <button className="btn btn-secondary" onClick={savePreferences} disabled={saving}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* ── Missions & Points ── */}
        <div className="fade-up delay-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <p className="section-label" style={{ margin: 0 }}>Missions</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--r-pill)', background: 'var(--gold-dim)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <span style={{ fontSize: '0.75rem' }}>⭐</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--gold)' }}>{totalPoints ?? 0} pts</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {MISSIONS.map(mission => {
              const done  = missionState.completed.includes(mission.id)
              const count = mission.repeatable ? getMissionCount(mission.id) : 0
              const colorMap = {
                green:  { bg: 'var(--green-dim)',  border: 'rgba(53,208,127,0.25)',  text: 'var(--green)'  },
                purple: { bg: 'var(--purple-dim)', border: 'rgba(129,140,248,0.25)', text: 'var(--purple)' },
                gold:   { bg: 'var(--gold-dim)',   border: 'rgba(251,191,36,0.25)',  text: 'var(--gold)'   },
              }
              const c = colorMap[mission.color] || colorMap.purple
              return (
                <div key={mission.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--r-lg)',
                  background: done ? c.bg : 'var(--bg-card)',
                  border: `1px solid ${done ? c.border : 'var(--border)'}`,
                  transition: 'all 0.3s',
                  opacity: done ? 1 : 0.72,
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '0.65rem', flexShrink: 0,
                    background: done ? c.bg : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${done ? c.border : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem',
                  }}>
                    {done ? mission.icon : '🔒'}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: done ? c.text : 'var(--text)', marginBottom: '0.1rem' }}>
                      {mission.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {mission.description}
                    </div>
                    {/* Repeatable: show how many times used */}
                    {mission.repeatable && count > 0 && (
                      <div style={{ fontSize: '0.68rem', color: c.text, fontWeight: 600, marginTop: '0.25rem' }}>
                        {count}x used · 1st: +{mission.pointsFirst} pts · each next: +{mission.points} pts
                      </div>
                    )}
                    {mission.repeatable && count === 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        1st use: +{mission.pointsFirst} pts · each next: +{mission.points} pts
                      </div>
                    )}
                  </div>

                  {/* Points badge */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {mission.repeatable ? (
                      <>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: done ? c.text : 'var(--text-muted)' }}>
                          +{mission.points}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>pts/use</div>
                        {count > 0 && (
                          <div style={{ fontSize: '0.68rem', color: c.text, fontWeight: 700, marginTop: '0.1rem' }}>
                            {count}x
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: done ? c.text : 'var(--text-muted)' }}>
                          +{mission.points}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>pts</div>
                        {done && (
                          <div style={{ fontSize: '0.65rem', color: c.text, fontWeight: 700, marginTop: '0.1rem' }}>✓ Done</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* ── History ── */}
        <div className="fade-up delay-3">
          <p className="section-label" style={{ marginBottom: '0.85rem' }}>Explained Papers</p>

          {loading ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>Loading…</p>
          ) : account?.history?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {account.history.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: i < account.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '0.5rem', flexShrink: 0, background: h.mode === 'full' ? 'var(--purple-dim)' : 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                    {h.mode === 'full' ? '📖' : '⚡'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title || 'Untitled'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{h.page_count} pages · {h.mode === 'full' ? 'Full Analysis' : 'Overview'} · {formatDate(h.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>No papers yet. Explain your first whitepaper to see it here.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
