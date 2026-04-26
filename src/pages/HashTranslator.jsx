/* ─────────────────────────────────────────────
   Hash Translator Page — NGL Paper
   ───────────────────────────────────────────── */
import { useState } from 'react'

/* ── Hash type detection ── */
function detectHashType(input) {
  const s = input.trim()
  if (!s) return null
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return 'tx'
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'address'
  if (/^0x[0-9a-fA-F]{63}$/.test(s) || /^[0-9a-fA-F]{64}$/.test(s)) return 'block'
  if (/^Qm[0-9a-zA-Z]{44}$/.test(s) || /^bafy/.test(s)) return 'ipfs'
  if (s.endsWith('.eth') || s.endsWith('.celo')) return 'ens'
  if (/^0x/.test(s)) return 'hex'
  return 'unknown'
}

const TYPE_META = {
  tx: {
    label: 'Tx Hash',
    color: 'gold',
    icon: '🔐',
    title: 'Transaction Hash',
    plain: 'This is a <strong>transaction ID</strong> — like a receipt number for a payment that happened on the blockchain. It uniquely identifies one specific transfer of funds or smart contract interaction. You can use it to look up exactly what happened, when, how much was sent, and who sent it.',
  },
  address: {
    label: 'Wallet',
    color: 'green',
    icon: '👛',
    title: 'Wallet Address',
    plain: 'This is a <strong>wallet address</strong> — like a bank account number, but for crypto. Anyone can send funds to this address, and only the person with the matching private key can spend what\'s in it. It\'s safe to share publicly for receiving payments.',
  },
  block: {
    label: 'Block Hash',
    color: 'purple',
    icon: '📦',
    title: 'Block Hash',
    plain: 'This is a <strong>block hash</strong> — like the fingerprint of a single page in the blockchain\'s ledger book. Each block contains hundreds of transactions. This hash proves the block\'s contents haven\'t been tampered with, and each block contains the hash of the one before it — forming an unbreakable chain.',
  },
  ipfs: {
    label: 'IPFS',
    color: 'purple',
    icon: '🌐',
    title: 'IPFS Content Hash',
    plain: 'This is an <strong>IPFS content identifier (CID)</strong> — a fingerprint of a file stored on the decentralized InterPlanetary File System. Unlike a URL that points to a server\'s location, this points to the actual content — so the file can never be secretly changed without making the hash invalid.',
  },
  ens: {
    label: 'ENS',
    color: 'green',
    icon: '🏷️',
    title: 'ENS / Celo Domain Name',
    plain: 'This is a <strong>human-readable domain name</strong> for a blockchain address — similar to how a website URL like "google.com" points to a server IP address. Instead of remembering a long hex address, people can just use this easy name to send funds or interact with a dApp.',
  },
  hex: {
    label: 'Hex Data',
    color: 'gold',
    icon: '🔢',
    title: 'Hex-encoded Data',
    plain: 'This looks like <strong>hexadecimal encoded data</strong> — raw bytes represented as numbers from 0-9 and letters A-F. This is often smart contract input data, encoded function calls, or arbitrary binary data that\'s being stored on-chain.',
  },
  unknown: {
    label: 'Unknown',
    color: 'unknown',
    icon: '❓',
    title: 'Unrecognized Format',
    plain: 'This doesn\'t match any common blockchain hash or identifier format. It might be a partial hash, a custom encoding, or possibly a typo. Double-check the input and make sure you\'re copying the full string.',
  },
}

/* Mock on-chain data for demo */
function getMockDetails(type, input) {
  const short = input.slice(0, 10) + '...' + input.slice(-8)
  switch (type) {
    case 'tx': return {
      'Status':    '✅ Success',
      'Network':   'Celo Mainnet',
      'Block':    '#28,431,200',
      'From':      '0x1a2b...9f0d',
      'To':        '0xdead...beef',
      'Value':     '5.00 CELO',
      'Gas used':  '21,000',
      'Timestamp': '2 minutes ago',
    }
    case 'address': return {
      'Type':      'EOA (Regular wallet)',
      'Network':   'Celo Mainnet',
      'CELO bal':  '12.34 CELO',
      'USDm bal':  '25.00 USDm',
      'Txs':       '147 transactions',
      'First seen':'6 months ago',
    }
    case 'block': return {
      'Block #':   '28,431,199',
      'Network':   'Celo Mainnet',
      'Txs':       '83 transactions',
      'Validator': '0x7f3a...c902',
      'Time':      '5 seconds ago',
      'Gas used':  '12,451,200 / 130,000,000',
    }
    case 'ipfs': return {
      'Type':      'IPFS File',
      'Codec':     'dag-pb (UnixFS)',
      'Size':      '~2.4 MB',
      'Gateway':   `ipfs.io/ipfs/${input.slice(0,14)}...`,
    }
    default: return { 'Raw': short }
  }
}

/* ── Component ── */
export default function HashTranslator({ address, setView, showToast }) {
  const [input, setInput]   = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const detected = detectHashType(input)
  const meta = detected ? TYPE_META[detected] : null

  const handleTranslate = () => {
    if (!input.trim()) { showToast('Paste a hash first', 'error'); return }
    setLoading(true)
    setTimeout(() => {
      setResult({ type: detected, input: input.trim(), meta: TYPE_META[detected], details: getMockDetails(detected, input.trim()) })
      setLoading(false)
      showToast('Hash translated ✓', 'success')
    }, 1600)
  }

  const handleReset = () => { setInput(''); setResult(null) }

  const EXAMPLES = [
    { label: 'Tx Hash',   value: '0x5c88d8a1f5c6f2b3e9d4a7b0c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1' },
    { label: 'Address',   value: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' },
    { label: 'IPFS CID',  value: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' },
  ]

  return (
    <div className="page">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem' }}>
          ⛓️ Hash Translator
        </div>
        <span className="feature-tag green" style={{ fontSize: '0.68rem' }}>Free</span>
      </div>

      <div className="page-content">

        {/* ── Input section ── */}
        {!result && (
          <>
            <div className="fade-up">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
                Paste any blockchain hash, wallet address, IPFS CID, or ENS domain name below.
              </p>
              <div className="hash-input-wrap">
                <textarea
                  className="hash-input"
                  placeholder="Paste hash, address, block ID..."
                  value={input}
                  onChange={e => { setInput(e.target.value); setResult(null) }}
                  rows={3}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                {detected && detected !== null && (
                  <span className={`hash-type-badge ${meta?.color || 'unknown'}`}>
                    {meta?.icon} {meta?.label}
                  </span>
                )}
              </div>
            </div>

            {/* Auto-detect info */}
            {detected && meta && (
              <div
                className="card fade-in"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem' }}
              >
                <span style={{ fontSize: '1.4rem' }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Detected: {meta.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Auto-identified format</div>
                </div>
                <span className={`feature-tag ${meta.color} `} style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>{meta.label}</span>
              </div>
            )}

            {/* Translate Button */}
            <button
              className="btn btn-primary fade-up delay-1"
              onClick={handleTranslate}
              disabled={loading || !input.trim()}
            >
              {loading
                ? <><span style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #0a0a15', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Translating...</>
                : '🔍 Translate Hash'}
            </button>

            {/* Example hashes */}
            <div className="card fade-up delay-2">
              <p className="section-label" style={{ marginBottom: '0.75rem' }}>Try an example</p>
              {EXAMPLES.map((ex, i) => (
                <div
                  key={ex.label}
                  onClick={() => setInput(ex.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0', borderBottom: i < EXAMPLES.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.9rem' }}>{['🔐','👛','🌐'][i]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{ex.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.value.slice(0, 28)}...</div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Result ── */}
        {result && (
          <div className="result-section">
            {/* Header */}
            <div className="result-header fade-up">
              <span className="result-badge">✓ Translated</span>
              <span className={`feature-tag ${result.meta.color}`} style={{ fontSize: '0.68rem' }}>
                {result.meta.icon} {result.meta.label}
              </span>
            </div>

            {/* Input display */}
            <div className="card fade-up delay-1" style={{ padding: '0.9rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '0.4rem' }}>Input</p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text-sub)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                {result.input}
              </p>
            </div>

            {/* Plain language explanation */}
            <div className="fade-up delay-2">
              <p className="section-label" style={{ marginBottom: '0.5rem' }}>Plain English</p>
              <div className="result-card">
                <div className="result-card-header">
                  {result.meta.icon} {result.meta.title}
                </div>
                <div className="result-card-body" dangerouslySetInnerHTML={{ __html: result.meta.plain }} />
              </div>
            </div>

            {/* On-chain details */}
            <div className="fade-up delay-3">
              <p className="section-label" style={{ marginBottom: '0.5rem' }}>On-chain Details</p>
              <div className="result-card">
                <div className="result-card-header">📊 Data from Celo explorer</div>
                <div style={{ padding: '0 1.1rem' }}>
                  <div className="hash-detail-grid">
                    {Object.entries(result.details).map(([label, value]) => (
                      <div className="hash-detail-row" key={label}>
                        <span className="hash-detail-label">{label}</span>
                        <span className="hash-detail-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleReset}>
                ← Translate another
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { navigator.clipboard.writeText(result.input); showToast('Copied!') }}
              >
                📋
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
