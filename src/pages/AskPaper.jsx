/* ─────────────────────────────────────────────
   Ask the Paper — NGL Paper (Real AI)
   ───────────────────────────────────────────── */
import { useState, useRef, useEffect } from 'react'

const BACKEND = window.__BACKEND_URL__ || ''

const WELCOME_MESSAGE = {
  role: 'ai',
  text: `Hello! I'm **Dr. Paper**, your expert guide to **crypto** and **blockchain**.

Ask me anything — I can explain:
- How **Bitcoin**, **Ethereum**, or **Celo** actually work
- What **DeFi**, **NFTs**, or **smart contracts** really are
- How to read **tokenomics** and understand investment risks
- Technical concepts like **consensus mechanisms**, **wallets**, or **Layer 2**

You can also attach a **PDF whitepaper** using the 📎 button below — I'll answer questions grounded in that specific document.

*What would you like to know?*`,
}

const formatDate = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMs / 3600000)
  const diffD   = Math.floor(diffMs / 86400000)
  if (diffMin < 1)  return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24)   return `${diffH}h ago`
  if (diffD < 7)    return `${diffD}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const SUGGESTED_QUESTIONS = [
  'What is Bitcoin?',
  'How does DeFi work?',
  'What is a smart contract?',
  'How do I read tokenomics?',
  'What is the difference between Celo and Ethereum?',
  'What are the risks of crypto investing?',
]

/* ── Render markdown bold & newlines ── */
const renderText = (text) => {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export default function AskPaper({ address, showToast, paperSession, setPaperSession, theme, toggleTheme }) {
  const [panel, setPanel]         = useState('chat')  // 'chat' | 'history'
  const [session, setSession]     = useState(null)
  const [messages, setMessages]   = useState([WELCOME_MESSAGE])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [chatId, setChatId]       = useState(null)   // DB chat session id
  const [chatList, setChatList]   = useState([])
  const [histLoading, setHistLoading] = useState(false)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  /* Effect 1: on mount — init general session only if no paperSession yet */
  useEffect(() => {
    if (!paperSession?.sessionId) initGeneralSession()
  }, []) // eslint-disable-line

  /* Effect 2: whenever paperSession arrives (on mount OR after background upload) */
  useEffect(() => {
    if (!paperSession?.sessionId) return
    fetch(`${BACKEND}/api/session/${paperSession.sessionId}`)
      .then(r => r.json())
      .then(meta => {
        setSession({ sessionId: paperSession.sessionId, isGeneral: false, filename: meta.filename || paperSession.filename, pageCount: meta.pageCount })
        setMessages([
          { role: 'ai',     text: `Hello! I'm **Dr. Paper** — **${meta.filename || paperSession.filename}** has been loaded. Ask me anything about it!` },
          { role: 'system', text: `📄 **${meta.filename || paperSession.filename}** loaded successfully (${meta.pageCount} pages).\n\nYou can now ask questions about this document.` },
        ])
      })
      .catch(() => {
        setSession({ sessionId: paperSession.sessionId, isGeneral: false, filename: paperSession.filename, pageCount: null })
        setMessages([{ role: 'ai', text: `Hello! I'm **Dr. Paper** — **${paperSession.filename}** is ready. Ask me anything!` }])
      })
  }, [paperSession?.sessionId]) // eslint-disable-line
  useEffect(() => { if (address) fetchChatList() }, [address]) // eslint-disable-line
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const initGeneralSession = async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/session/general`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) setSession(data)
    } catch { /* retry on first message */ }
  }

  /* ── DB: fetch chat list ── */
  const fetchChatList = async () => {
    if (!address) return
    setHistLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/chats/${address}`)
      if (res.ok) setChatList(await res.json())
    } catch { /* silent */ }
    finally { setHistLoading(false) }
  }

  /* ── Persist / restore paper session via localStorage ── */
  const savePaperSessionLink = (chatDbId, backendSessionId) => {
    try { localStorage.setItem(`ps_${chatDbId}`, backendSessionId) } catch {}
  }
  const getPaperSessionLink = (chatDbId) => {
    try { return localStorage.getItem(`ps_${chatDbId}`) } catch { return null }
  }

  /* ── DB: get/create chat session id, then save message ── */
  const saveMessage = async (role, text, currentChatId) => {
    if (!address) return currentChatId
    let id = currentChatId
    if (!id) {
      try {
        const res  = await fetch(`${BACKEND}/api/chats/${address}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 80) }),
        })
        const data = await res.json()
        id = data.id
        setChatId(id)
        fetchChatList()
        // If currently in paper mode, link this chat to the backend session
        if (session?.sessionId && !session.isGeneral) {
          savePaperSessionLink(id, session.sessionId)
        }
      } catch { return null }
    }
    fetch(`${BACKEND}/api/chats/${address}/${id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, text }),
    }).catch(() => {})
    return id
  }

  /* ── Load a previous chat ── */
  const loadChat = async (item) => {
    setPanel('chat')
    setHistLoading(true)
    try {
      const res  = await fetch(`${BACKEND}/api/chats/${address}/${item.id}`)
      const msgs = await res.json()
      const restored = msgs.map(m => ({ role: m.role, text: m.text }))
      setMessages(restored.length ? restored : [WELCOME_MESSAGE])
      setChatId(item.id)

      // Try to restore paper session if this chat had one
      const linkedSessionId = getPaperSessionLink(item.id)
      if (linkedSessionId) {
        const sr = await fetch(`${BACKEND}/api/session/${linkedSessionId}`).catch(() => null)
        if (sr?.ok) {
          const meta = await sr.json()
          setSession({ sessionId: linkedSessionId, isGeneral: false, filename: meta.filename, pageCount: meta.pageCount })
          setMessages(prev => [
            ...prev,
            { role: 'system', text: `📄 Context for **${meta.filename}** restored (${meta.pageCount} pages). You can continue asking questions about this document.` },
          ])
          return
        } else {
          // Session expired - clean up and warn
          try { localStorage.removeItem(`ps_${item.id}`) } catch {}
          setMessages(prev => [
            ...prev,
            { role: 'system', text: '⚠️ Document context has expired (>2 hours). Re-upload the PDF to continue.' },
          ])
        }
      }
      await initGeneralSession()
    } catch { showToast('Failed to load chat', 'error') }
    finally { setHistLoading(false) }
  }

  /* ── New chat ── */
  const newChat = () => {
    setMessages([WELCOME_MESSAGE])
    setChatId(null)
    setSession(null)
    setPanel('chat')
    if (setPaperSession) setPaperSession(null)
    initGeneralSession()
  }

  /* ── Upload PDF ── */
  const uploadPDF = async (file) => {
    setAnalyzing(true); setShowAttach(false)
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      const res  = await fetch(`${BACKEND}/api/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSession(data)
      const freeMsg = data.isFree
        ? `✅ **${data.pageCount} pages** — within the free tier.`
        : `⚠️ **${data.pageCount} pages** — first 15 pages free, ${data.extraPages} extra pages ($${data.estimatedCost}).`
      const sysText = `📄 **${data.filename}** loaded (${data.pageCount} pages).\n\n${freeMsg}\n\nAsk me anything about this document!`
      setMessages(prev => [...prev, { role: 'system', text: sysText }])
    } catch (err) { showToast(err.message || 'Upload failed', 'error') }
    finally { setAnalyzing(false) }
  }

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      showToast('Only PDF files supported', 'error'); return
    }
    await uploadPDF(f)
  }

  /* ── Send message ── */
  const sendMessage = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    const newChatId = await saveMessage('user', q, chatId)

    let currentSession = session
    if (!currentSession?.sessionId) {
      try {
        const res = await fetch(`${BACKEND}/api/session/general`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) { setSession(data); currentSession = data }
      } catch { /* ignore */ }
    }
    if (!currentSession?.sessionId) {
      setMessages(prev => [...prev, { role: 'error', text: 'Unable to connect to server. Please try again.' }])
      setLoading(false); return
    }

    try {
      const res  = await fetch(`${BACKEND}/api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.sessionId, question: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI failed')
      setMessages(prev => [...prev, { role: 'ai', text: data.answer }])
      saveMessage('ai', data.answer, newChatId || chatId)
    } catch (err) {
      const errMsg = err.message || 'Something went wrong'
      setMessages(prev => [...prev, { role: 'error', text: errMsg }])
      if (errMsg.includes('Session not found')) { setSession(null); initGeneralSession() }
    } finally { setLoading(false); inputRef.current?.focus() }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleDetachDocument = async () => {
    await initGeneralSession()
    setMessages(prev => [...prev, { role: 'system', text: '📄 Document detached. You can now ask general questions about crypto and blockchain.' }])
  }

  const isDocumentMode = session && !session.isGeneral

  /* ══════════════════════════════════════
     HISTORY PANEL
  ══════════════════════════════════════ */
  if (panel === 'history') {
    return (
      <div className="page">
        <div className="topbar">
          <button onClick={() => setPanel('chat')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '0.25rem', marginRight: '0.25rem' }}>←</button>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', flex: 1 }}>Chat History</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={toggleTheme} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '999px', width: 30, height: 30, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={newChat} style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', borderRadius: 'var(--r-pill)', background: 'var(--purple-dim)', border: '1px solid rgba(129,140,248,0.3)', color: 'var(--purple)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}>+ New</button>
          </div>
        </div>
        <div className="page-content">
          {!address ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>👛</div>
              <div style={{ fontSize: '0.87rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>Wallet not connected</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>Connect your wallet to save and view chat history.</div>
            </div>
          ) : histLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 0' }}>Loading…</p>
          ) : chatList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💬</div>
              <div style={{ fontSize: '0.87rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>No chats yet</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>Send your first message — history saves automatically.</div>
              <button onClick={newChat} className="btn btn-primary" style={{ width: 'auto', paddingInline: '1.5rem' }}>Start Chat</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {chatList.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => loadChat(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 0', background: 'none', border: 'none', borderBottom: i < chatList.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'opacity 0.2s' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '0.5rem', background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>💬</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: chatId === item.id ? 'var(--purple)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Chat'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{formatDate(item.updated_at)}</div>
                  </div>
                  {chatId === item.id && <span style={{ fontSize: '0.65rem', color: 'var(--purple)', fontWeight: 700 }}>Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════
     CHAT PANEL
  ══════════════════════════════════════ */
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Bar ── */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: '0.5rem', background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>💬</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.87rem', fontWeight: 700, color: 'var(--text)' }}>Ask the Paper</div>
            {isDocumentMode ? (
              <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {session.filename}</div>
            ) : (
              <div style={{ fontSize: '0.67rem', color: 'var(--purple)' }}>Crypto & Blockchain</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {isDocumentMode && (
            <button onClick={handleDetachDocument} style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Detach</button>
          )}
          <button onClick={toggleTheme} style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={newChat} title="New chat" style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>✏️</button>
          <button onClick={() => { setPanel('history'); fetchChatList() }} title="History" style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>🕐</button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.25rem' }}>
            {msg.role === 'system' && (
              <div style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 'var(--r-lg)', fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.6 }}>
                {renderText(msg.text)}
              </div>
            )}
            {msg.role === 'user' && (
              <>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingRight: '0.25rem' }}>You</span>
                <div style={{ maxWidth: '82%', padding: '0.7rem 1rem', background: 'linear-gradient(135deg, var(--gold), #e8eb30)', color: '#0a0a15', borderRadius: '1rem 1rem 0.25rem 1rem', fontSize: '0.87rem', fontWeight: 500, lineHeight: 1.5 }}>{msg.text}</div>
              </>
            )}
            {msg.role === 'ai' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--purple-dim)', border: '1px solid rgba(129,140,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>🤖</div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Dr. Paper</span>
                </div>
                <div style={{ maxWidth: '88%', padding: '0.85rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.25rem 1rem 1rem 1rem', fontSize: '0.87rem', color: 'var(--text-sub)', lineHeight: 1.7 }}>
                  {renderText(msg.text)}
                </div>
              </>
            )}
            {msg.role === 'error' && (
              <div style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--r-lg)', fontSize: '0.82rem', color: 'var(--red)' }}>
                ⚠️ {msg.text}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--purple-dim)', border: '1px solid rgba(129,140,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>🤖</div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Typing…</span>
            </div>
            <div style={{ padding: '0.85rem 1.1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.25rem 1rem 1rem 1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {[0, 1, 2].map(n => (
                <span key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested questions ── */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 1.25rem 0.75rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SUGGESTED_QUESTIONS.map(q => (
            <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }}
              style={{ flexShrink: 0, padding: '0.4rem 0.85rem', borderRadius: 'var(--r-pill)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-sub)', fontSize: '0.75rem', fontFamily: 'var(--font)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >{q}</button>
          ))}
        </div>
      )}

      {/* ── Attach PDF panel ── */}
      {showAttach && (
        <div style={{ margin: '0 1.25rem 0.75rem', padding: '1rem', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.6rem' }}>Attach a document</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>Upload a whitepaper or any blockchain PDF — Dr. Paper will answer questions specifically about it.</p>
          <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} />
          {analyzing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 18, height: 18, border: '2px solid rgba(129,140,248,0.2)', borderTop: '2px solid var(--purple)', borderRadius: '50%', animation: 'spin 0.9s linear infinite', display: 'block', flexShrink: 0 }} />Reading PDF…
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--r-lg)', background: 'var(--purple-dim)', border: '1px solid rgba(129,140,248,0.3)', color: 'var(--purple)', fontSize: '0.82rem', fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 600 }}>Choose PDF</button>
              <button onClick={() => setShowAttach(false)} style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--r-lg)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{ padding: '0.6rem 1rem', background: 'var(--bg)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <button onClick={() => setShowAttach(v => !v)} title="Attach PDF"
          style={{ width: 38, height: 38, borderRadius: '50%', background: showAttach ? 'var(--purple-dim)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showAttach ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
        >📎</button>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Ask anything about crypto & blockchain…"
          rows={1}
          style={{ flex: 1, padding: '0.65rem 0.9rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1.25rem', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '0.87rem', lineHeight: 1.5, outline: 'none', resize: 'none', maxHeight: 120, overflowY: 'auto' }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading}
          style={{ height: 38, minWidth: 38, paddingInline: input.trim() && !loading ? '1rem' : '0', width: input.trim() && !loading ? 'auto' : 38, borderRadius: '1.25rem', background: input.trim() && !loading ? 'linear-gradient(135deg, #fcff52, #f0c030)' : 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font)', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)', flexShrink: 0, color: '#0a0a15', boxShadow: input.trim() && !loading ? '0 2px 12px rgba(252,255,82,0.35)' : 'none' }}
        >
          {loading
            ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid rgba(255,255,255,0.7)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'block' }} />
            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>{input.trim() && <span>Send</span>}</>
          }
        </button>
      </div>
    </div>
  )
}
