/* ─────────────────────────────────────────────
   Whitepaper Explainer Page — NGL Paper
   Real AI integration via /api/explain + /api/explain-url
   ───────────────────────────────────────────── */
import { useState, useRef, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import { encodeFunctionData } from 'viem'

const API_BASE = import.meta.env.VITE_BACKEND_URL || window.__BACKEND_URL__ || 'http://localhost:3001'
const PRICE_PER_PAGE_USD = 0.01

const CELO_MAINNET = { chainId: 42220, chainIdHex: '0xa4ec', name: 'Celo Mainnet', nativeSymbol: 'CELO', rpcUrl: 'https://forno.celo.org', explorer: 'https://celoscan.io' }

// Minimal ABI for NGLPaperPayment contract
const CONTRACT_ABI = [
  { name: 'explainWithCELO', type: 'function', inputs: [{ name: 'pages', type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { name: 'explainWithCUSD', type: 'function', inputs: [{ name: 'pages', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
]
// Minimal ERC-20 ABI for cUSD approve
const ERC20_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
]

export default function Whitepaper({ address, balance, setView, showToast, setPaperSession, theme, toggleTheme }) {
  const [tab, setTab]             = useState('pdf')
  const [file, setFile]           = useState(null)
  const [url, setUrl]             = useState('')
  const [pageCount, setPageCount] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [pdfBlob, setPdfBlob]     = useState(null)
  const [step, setStep]           = useState('input')
  const [progress, setProgress]   = useState('')
  const [urlMeta, setUrlMeta]     = useState(null)
  const [mode, setMode]           = useState('simply')
  const [language, setLanguage]   = useState('auto')
  const [pdfFilename, setPdfFilename] = useState('')
  // Payment states
  const [prices, setPrices]               = useState({ celo: null, eth: null })
  const [payRequired, setPayRequired]     = useState(false)
  const [paying, setPaying]               = useState(false)
  const [payStatus, setPayStatus]         = useState('')
  const payNetwork = CELO_MAINNET
  const [payToken, setPayToken]           = useState('cUSD')   // 'cUSD' | 'CELO'
  const [contractByChain, setContractByChain] = useState({})
  const [cUSDByChain, setCUSDByChain]     = useState({})

  const fileRef = useRef(null)

  const totalFeeUsd   = (pageCount || 1) * PRICE_PER_PAGE_USD
  const nativePrice   = prices.celo
  const nativeAmount  = nativePrice ? (totalFeeUsd / nativePrice) : null
  const contractAddr  = contractByChain[payNetwork.chainId] || null
  const cUSDAddr      = cUSDByChain[payNetwork.chainId] || null
  // cUSD amount: $0.01/page × pages (cUSD = $1, 18 decimals)
  const cUSDAmountWei = BigInt(Math.round(totalFeeUsd * 1e18))

  /* ── Fetch config + prices on mount ── */
  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then(r => r.json())
      .then(d => {
        setPayRequired(d.paymentRequired)
        if (d.contractByChain) setContractByChain(d.contractByChain)
        if (d.cUSDByChain)     setCUSDByChain(d.cUSDByChain)
      })
      .catch(() => {})
    fetch(`${API_BASE}/api/prices`)
      .then(r => r.json())
      .then(d => setPrices({ celo: d.celo, eth: d.eth }))
      .catch(() => {})
  }, [])

  /* ── Switch to selected payment network ── */
  const switchToNetwork = async (net) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: net.chainIdHex }],
      })
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId:         net.chainIdHex,
            chainName:       net.name,
            nativeCurrency:  { name: net.symbol, symbol: net.symbol, decimals: 18 },
            rpcUrls:         [net.rpcUrl],
            blockExplorerUrls: [net.explorer],
          }],
        })
      } else {
        throw err
      }
    }
  }

  /* ── Wait for tx receipt via window.ethereum ── */
  const waitForReceipt = async (hash) => {
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 2500))
      const receipt = await window.ethereum?.request({
        method: 'eth_getTransactionReceipt', params: [hash]
      }).catch(() => null)
      if (receipt?.status === '0x1') return receipt
      if (receipt?.status === '0x0') throw new Error('Transaction failed on blockchain')
    }
    throw new Error('Confirmation timeout — please check your wallet')
  }

  /* ── Payment + Explain flow ── */
  const handlePayAndExplain = async () => {
    if (!address) { showToast('Please connect your wallet first', 'error'); return }
    if (!contractAddr) { showToast('Contract not configured for this network', 'error'); return }

    setPaying(true)
    let txHash = null
    const chainId = payNetwork.chainId
    try {
      setPayStatus(`Switching to ${payNetwork.name}...`)
      await switchToNetwork(payNetwork)

      if (payToken === 'cUSD') {
        /* ── Step 1: Approve cUSD ────────────────────────── */
        setPayStatus('Approving cUSD spend...')
        const approveData = encodeFunctionData({
          abi: ERC20_ABI, functionName: 'approve',
          args: [contractAddr, cUSDAmountWei],
        })
        const approveTx = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: cUSDAddr, data: approveData }],
        })
        setPayStatus('Waiting for approval... ⛓️')
        await waitForReceipt(approveTx)

        /* ── Step 2: Pay via contract ───────────────────── */
        setPayStatus('Sending cUSD payment...')
        const payData = encodeFunctionData({
          abi: CONTRACT_ABI, functionName: 'explainWithCUSD',
          args: [BigInt(pageCount || 1)],
        })
        txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: contractAddr, data: payData }],
        })
      } else {
        /* ── CELO payment via contract ───────────────────── */
        if (!nativePrice) { showToast('Failed to fetch CELO price. Try again.', 'error'); return }
        const amountWei = BigInt(Math.ceil(nativeAmount * 1e18))
        const hexValue  = '0x' + amountWei.toString(16)
        setPayStatus('Sending CELO payment...')
        const payData = encodeFunctionData({
          abi: CONTRACT_ABI, functionName: 'explainWithCELO',
          args: [BigInt(pageCount || 1)],
        })
        txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: contractAddr, value: hexValue, data: payData }],
        })
      }

      setPayStatus('Waiting for blockchain confirmation... ⛓️')
      showToast('Transaction sent! Waiting for confirmation...', 'success')
      await waitForReceipt(txHash)
      setPayStatus('Payment confirmed ✓')
      showToast('Payment confirmed ✓', 'success')

      if (tab === 'pdf') await handleExplainPdf(txHash, chainId)
      else await handleExplainUrl(txHash, chainId)
    } catch (err) {
      if (err.code === 4001 || err.message?.includes('rejected')) {
        showToast('Payment cancelled', 'error')
      } else {
        showToast('Error: ' + (err.message || 'Unknown'), 'error')
      }
      setPayStatus('')
    } finally {
      setPaying(false)
    }
  }

  /* ── Read exact page count from PDF binary using pdf-lib ── */
  const analyzeFile = async (f) => {
    setAnalyzing(true)
    try {
      const arrayBuffer = await f.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      const pages = pdfDoc.getPageCount()
      setFile(f)
      setPageCount(pages)
      setStep('confirm')
    } catch (err) {
      console.error('PDF parse error:', err)
      showToast('Could not read PDF. Try another file.', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      showToast('Only PDF files are supported', 'error')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      showToast('File too large (max 20 MB)', 'error')
      return
    }
    await analyzeFile(f)
  }

  /* ── Validate & preview URL ── */
  const handleUrlPreview = () => {
    if (!url.trim()) { showToast('Please enter a URL', 'error'); return }
    try { new URL(url.trim()) } catch (_) {
      showToast('Invalid URL format', 'error'); return
    }
    const hostname = new URL(url.trim()).hostname
    // Rough page estimate for URL (will be recalculated on backend)
    setPageCount(10)
    setUrlMeta({ hostname })
    setStep('confirm')
  }

  /* ── Real AI Explain: PDF file ── */
  const handleExplainPdf = async (txHash = null, chainId = null) => {
    if (!file) return
    setLoading(true)
    setProgress('Uploading PDF...')
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('mode', mode)
      formData.append('language', language)
      if (txHash)  formData.append('txHash', txHash)
      if (chainId) formData.append('chainId', String(chainId))
      setStep('loading')
      setProgress(mode === 'full' ? 'Dr. Paper is doing a full analysis... 📖' : 'Dr. Paper is reading... ✨')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), mode === 'full' ? 240000 : 120000)
      const response = await fetch(`${API_BASE}/api/explain`, { method: 'POST', body: formData, signal: ctrl.signal })
      clearTimeout(timer)
      await handleExplainResponse(response)
    } catch (err) {
      setStep('confirm')
      showToast(err.name === 'AbortError' ? 'Timeout: AI is taking too long, please try again.' : 'Error: ' + err.message, 'error')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  /* ── Real AI Explain: URL ── */
  const handleExplainUrl = async (txHash = null, chainId = null) => {
    if (!url.trim()) return
    setLoading(true)
    setProgress('Fetching page content...')
    try {
      setStep('loading')
      setProgress(mode === 'full' ? 'Dr. Paper is doing a full analysis... 📖' : 'Dr. Paper is reading... ✨')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), mode === 'full' ? 240000 : 120000)
      const response = await fetch(`${API_BASE}/api/explain-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode, language, txHash, chainId, clientPageCount: pageCount }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      await handleExplainResponse(response)
    } catch (err) {
      setStep('confirm')
      showToast(err.name === 'AbortError' ? 'Timeout: AI is taking too long, please try again.' : 'Error: ' + err.message, 'error')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  /* ── Shared response handler ── */
  const handleExplainResponse = async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || `Server error ${response.status}`)
    }

    setProgress('Preparing results... 📄')

    const data = await response.json()

    if (data.pageCount) setPageCount(data.pageCount)

    if (data.pdfBase64) {
      try {
        const byteChars = atob(data.pdfBase64)
        const byteArr   = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
        setPdfBlob(new Blob([byteArr], { type: 'application/pdf' }))
        if (data.filename) setPdfFilename(data.filename)
      } catch (_) {}
    }

    const finalResult = data.explanation || {
      title: file?.name || url,
      author: 'Unknown',
      tldr: 'Explanation generated. Download the PDF to read it.',
      sections: [],
    }
    if (data.sessionId && setPaperSession) {
      setPaperSession({ sessionId: data.sessionId, filename: finalResult.title || file?.name || url || 'Paper' })
    }

    setResult(finalResult)
    setStep('result')
    showToast('Paper explained! ✓', 'success')

    if (address) {
      fetch(`${API_BASE}/api/account/${address}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:      finalResult.title || file?.name || url || 'Untitled',
          page_count: data.pageCount || pageCount,
          mode,
          language,
        }),
      }).catch(() => {})
    }
  }

  /* ── Navigate to Ask Dr. Paper, creating session if needed ── */
  const handleAskDrPaper = () => {
    setView('askpaper')  // always navigate immediately
    if (!paperSession?.sessionId && tab === 'pdf' && file && setPaperSession) {
      const formData = new FormData()
      formData.append('pdf', file)
      fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => { if (d.sessionId) setPaperSession({ sessionId: d.sessionId, filename: result?.title || file.name }) })
        .catch(() => {})
    }
  }

  const handleExplain = () => {
    if (payRequired) handlePayAndExplain()
    else if (tab === 'pdf') handleExplainPdf()
    else handleExplainUrl()
  }

  /* ── Trigger PDF download ── */
  const handleDownload = () => {
    if (!pdfBlob) return
    const blobUrl = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    const safeName = (result?.title || file?.name || 'explanation')
      .replace(/[^a-z0-9_\-\s]/gi, '_').slice(0, 60)
    a.href = blobUrl
    a.download = pdfFilename || `${safeName}_explained.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
    showToast('PDF downloaded! ✓', 'success')
  }

  const handleReset = () => {
    setFile(null); setUrl(''); setPageCount(null)
    setResult(null); setPdfBlob(null); setUrlMeta(null)
    setPdfFilename(''); setPayStatus(''); setPayNetwork(PAYMENT_NETWORKS[0])
    setStep('input'); setLoading(false); setProgress('')
    if (fileRef.current) fileRef.current.value = ''
  }

  /* ─────────────────────────── */
  /*  Source label for confirm   */
  /* ─────────────────────────── */
  const sourceLabel = tab === 'pdf'
    ? file?.name
    : (url.length > 50 ? url.slice(0, 48) + '…' : url)

  const sourceMeta = tab === 'pdf'
    ? `${file?.size ? (file.size / 1024).toFixed(0) + ' KB · ' : ''}${pageCount} pages detected`
    : `${urlMeta?.hostname ?? 'Web page'} · ~${pageCount} pages estimated`

  /* ───────────────────────────────────────────────────── */
  return (
    <div className="page">

      {/* ── Top Bar ── */}
      <div className="topbar">
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>
          Explain Paper
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.2rem 0.55rem', borderRadius: '999px', border: '1px solid var(--border)' }}>$0.01/page</span>
          <button
            onClick={toggleTheme}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '999px', width: 30, height: 30, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* ──── STEP: INPUT ──── */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Tab row */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}>
              {[{ id: 'pdf', label: 'PDF Upload' }, { id: 'url', label: 'URL / Link' }].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                  fontSize: '0.85rem', fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                  paddingBottom: '0.65rem', borderBottom: `2px solid ${tab === t.id ? 'var(--purple)' : 'transparent'}`,
                  marginBottom: '-1px', transition: 'all 0.2s',
                }}>{t.label}</button>
              ))}
            </div>

            {tab === 'pdf' && (
              <>
                <label
                  htmlFor="pdf-upload-input"
                  style={{
                    border: '1.5px dashed var(--border)', borderRadius: '1rem', padding: '2.5rem 1rem',
                    textAlign: 'center', cursor: analyzing ? 'default' : 'pointer',
                    background: 'var(--bg-card)', transition: 'border-color 0.2s', display: 'block',
                  }}
                >
                  <input
                    ref={fileRef}
                    id="pdf-upload-input"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {analyzing ? (
                    <>
                      <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTop: '2px solid var(--purple)', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 0.75rem' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>Reading PDF…</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>📄</div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>Upload PDF</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Whitepaper, research paper, docs — max 20 MB</p>
                    </>
                  )}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[['Upload your PDF', 'Any whitepaper or research paper'], ['AI reads & analyzes', 'Deep structural understanding'], ['Get a clear explanation', 'Download as formatted PDF']].map(([t, d], i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--purple-dim)', border: '1px solid var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--purple)', flexShrink: 0 }}>{i + 1}</div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{t}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'url' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontFamily: 'var(--font)', fontSize: '0.85rem', color: 'var(--text)', outline: 'none' }}
                  placeholder="https://docs.project.io/whitepaper"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlPreview()}
                />
                <button className="btn btn-primary" onClick={handleUrlPreview} disabled={!url.trim()}>
                  Preview & Continue
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Supports GitBook, direct PDF links, Notion, HackMD, Mirror, and most documentation pages. Only the current page is analyzed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ──── STEP: CONFIRM ──── */}
        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* File header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '0.65rem', background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                {tab === 'pdf' ? '📄' : '🔗'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourceLabel}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{sourceMeta}</div>
              </div>
              <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Explain mode */}
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Mode</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[{ id: 'simply', label: 'Overview', desc: 'Key points & summary' }, { id: 'full', label: 'Full Analysis', desc: 'Every detail explained' }].map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)} style={{
                    flex: 1, padding: '0.7rem 0.6rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font)', transition: 'all 0.2s',
                    border: `1.5px solid ${mode === m.id ? 'var(--purple)' : 'var(--border)'}`,
                    background: mode === m.id ? 'var(--purple-dim)' : 'var(--bg-card)',
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: mode === m.id ? 'var(--purple)' : 'var(--text)', marginBottom: '0.15rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Output Language</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[{ id: 'auto', label: 'Auto' }, { id: 'english', label: 'English' }, { id: 'indonesian', label: 'Indonesian' }].map(l => (
                  <button key={l.id} onClick={() => setLanguage(l.id)} style={{
                    flex: 1, padding: '0.45rem 0.25rem', borderRadius: '999px', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: '0.75rem', transition: 'all 0.2s',
                    border: `1px solid ${language === l.id ? 'var(--purple)' : 'var(--border)'}`,
                    background: language === l.id ? 'var(--purple-dim)' : 'transparent',
                    color: language === l.id ? 'var(--purple)' : 'var(--text-muted)',
                    fontWeight: language === l.id ? 600 : 400,
                  }}>{l.label}</button>
                ))}
              </div>
            </div>

            {/* Token selector */}
            {payRequired && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Pay with</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['cUSD', 'CELO'].map(tok => (
                    <button key={tok} onClick={() => setPayToken(tok)} style={{
                      flex: 1, padding: '0.55rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font)', transition: 'all 0.2s',
                      border: `1.5px solid ${payToken === tok ? 'var(--purple)' : 'var(--border)'}`,
                      background: payToken === tok ? 'rgba(139,92,246,0.08)' : 'transparent',
                    }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: payToken === tok ? 'var(--purple)' : 'var(--text)' }}>{tok}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{tok === 'cUSD' ? 'Stable · $1.00' : 'Native Celo'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price summary */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '0.75rem', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {[
                ['Pages', `${pageCount}${tab === 'url' ? ' (est.)' : ''}`],
                ['Rate', '$0.01 / page'],
                ['Total', payToken === 'cUSD'
                  ? `${totalFeeUsd.toFixed(4)} cUSD`
                  : nativeAmount ? `${nativeAmount.toFixed(6)} CELO` : `$${totalFeeUsd.toFixed(2)}`],
              ].map(([label, val], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: i === 2 ? '0.9rem' : '0.8rem', fontWeight: i === 2 ? 700 : 500, color: i === 2 ? 'var(--text)' : 'var(--text-sub)' }}>{val}</span>
                </div>
              ))}
              {balance && <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.35rem', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your balance</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{balance} CELO</span>
              </div>}
              {!address && payRequired && <p style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '0.25rem' }}>Connect your wallet to pay</p>}
              {payStatus && <p style={{ fontSize: '0.75rem', color: 'var(--purple)', marginTop: '0.25rem' }}>{payStatus}</p>}
            </div>

            {/* CTA */}
            <button
              className="btn btn-primary"
              onClick={handleExplain}
              disabled={loading || paying || (!address && payRequired) || (payRequired && !contractAddr)}
              style={{ fontWeight: 700 }}
            >
              {paying ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.15)', borderTop: '2px solid #0a0a15', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> {payStatus || 'Processing…'}</>
              ) : loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.15)', borderTop: '2px solid #0a0a15', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> {progress || 'Processing…'}</>
              ) : payRequired ? (
                payToken === 'cUSD'
                  ? `Pay ${totalFeeUsd.toFixed(4)} cUSD & Explain`
                  : `Pay ${nativeAmount ? nativeAmount.toFixed(6) + ' CELO' : '$' + totalFeeUsd.toFixed(2)} & Explain`
              ) : (
                mode === 'full' ? 'Full Analysis' : 'Explain Paper'
              )}
            </button>

            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleReset}>
              ← Change document
            </button>
          </div>
        )}

        {/* ──── STEP: LOADING ──── */}
        {step === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', padding: '4rem 1rem', minHeight: '60vh', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, border: '2px solid var(--border)', borderTop: '2px solid var(--purple)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>Analyzing your document</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{progress || 'This may take 20–60 seconds…'}</p>
            </div>
          </div>
        )}

        {/* ──── STEP: RESULT ──── */}
        {step === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Paper header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--green)', background: 'var(--green-dim)', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                  {mode === 'full' ? 'Full Analysis' : 'Overview'} · {pageCount} pages
                </span>
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, marginBottom: '0.3rem' }}>{result.title}</h2>
              {result.author && result.author !== 'Unknown' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{result.author}</p>
              )}
            </div>

            {/* TL;DR */}
            {result.tldr && (
              <div style={{ borderLeft: '3px solid var(--purple)', paddingLeft: '1rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>Summary</p>
                <p style={{ fontSize: '0.87rem', color: 'var(--text-sub)', lineHeight: 1.7 }}>{result.tldr}</p>
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Sections */}
            {result.sections?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                {result.sections.map((s, i) => {
                  const isNew = s.simple_explanation || s.detailed_explanation
                  return (
                    <div key={i}>
                      {/* Heading */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 20 }}>{String(i + 1).padStart(2, '0')}</span>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>{s.heading}</h3>
                      </div>

                      {isNew ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingLeft: '1.6rem' }}>
                          {/* Simple explanation */}
                          {s.simple_explanation && (
                            <p style={{ fontSize: '0.87rem', color: 'var(--text)', lineHeight: 1.7 }}>{s.simple_explanation}</p>
                          )}
                          {/* Detailed explanation */}
                          {s.detailed_explanation && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: 1.75 }}>{s.detailed_explanation}</p>
                          )}
                          {/* Key terms */}
                          {s.key_terms?.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Key Terms</p>
                              {s.key_terms.map((kt, ki) => (
                                <div key={ki}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{kt.term}</span>
                                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}> — {kt.meaning}</span>
                                  {kt.analogy && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem', fontStyle: 'italic' }}>e.g. {kt.analogy}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Core summary */}
                          {s.core_summary && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', lineHeight: 1.65 }}>{s.core_summary}</p>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.87rem', color: 'var(--text-sub)', lineHeight: 1.75, paddingLeft: '1.6rem' }}>{s.body}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button className="btn btn-primary" onClick={handleAskDrPaper} style={{ fontWeight: 700 }}>
                Ask a question about this paper
              </button>
              {pdfBlob && (
                <button className="btn btn-secondary" onClick={handleDownload}>
                  Download PDF
                </button>
              )}
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleReset}>
                Explain another paper
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
