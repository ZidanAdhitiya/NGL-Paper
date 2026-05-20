import { useState, useEffect, useCallback } from 'react'
import { createWalletClient, createPublicClient, custom, http, formatEther } from 'viem'
import { celo } from 'viem/chains'
import Home from './pages/Home'
import Whitepaper from './pages/Whitepaper'
import AskPaper from './pages/AskPaper'
import Profile from './pages/Profile'
import BackgroundCanvas from './components/BackgroundCanvas'
import { completeMission, getTotalPoints } from './utils/points'
import './index.css'

/* ─── Wallet helpers ──────────────────────── */
const isMiniPayEnv = () =>
  typeof window !== 'undefined' && window.ethereum?.isMiniPay

const shortenAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''

/* ─── App ─────────────────────────────────── */
export default function App() {
  const [view, setView]         = useState('home')          // 'home' | 'whitepaper' | 'hash'
  const [address, setAddress]   = useState(null)
  const [balance, setBalance]   = useState(null)
  const [network, setNetwork]   = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType]   = useState('success')
  const [toastVisible, setToastVisible] = useState(false)
  const [paperSession, setPaperSession] = useState(null)  // { sessionId, filename }
  const [theme, setTheme] = useState(() => localStorage.getItem('ngl-theme') || 'dark')
  const [totalPoints, setTotalPoints] = useState(() => getTotalPoints())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ngl-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  /* Auto-connect inside MiniPay */
  useEffect(() => {
    if (isMiniPayEnv()) connectWallet()
  }, []) // eslint-disable-line

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) { showToast('No wallet detected', 'error'); return }
    try {
      const wc = createWalletClient({ transport: custom(window.ethereum) })
      const [addr] = await wc.requestAddresses()

      // Switch to Celo Mainnet automatically
      const chainId = parseInt(await window.ethereum.request({ method: 'eth_chainId' }), 16)
      if (chainId !== celo.id) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa4ec' }],
          })
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: '0xa4ec', chainName: 'Celo Mainnet', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: ['https://forno.celo.org'], blockExplorerUrls: ['https://celoscan.io'] }],
            })
          }
        }
      }

      setAddress(addr)
      setNetwork('Celo Mainnet')

      const pc = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') })
      const bal = await pc.getBalance({ address: addr })
      setBalance(parseFloat(formatEther(bal)).toFixed(4))

      // Award mission: wallet_connect
      const { awarded, points } = completeMission('wallet_connect')
      if (awarded) {
        setTotalPoints(prev => prev + points)
        showToast(`🎉 Mission complete! +${points} pts — First Connection`, 'success')
      } else {
        showToast('Wallet connected ✓', 'success')
      }
    } catch (e) {
      console.error(e)
      showToast('Connect failed', 'error')
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    setAddress(null)
    setBalance(null)
    setNetwork(null)
    showToast('Wallet disconnected', 'success')
  }, [])

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2400)
  }

  const onMissionComplete = useCallback((missionId) => {
    const { awarded, points } = completeMission(missionId)
    if (awarded) {
      setTotalPoints(prev => prev + points)
      import('./utils/points').then(({ MISSIONS }) => {
        const m = MISSIONS.find(x => x.id === missionId)
        if (m) showToast(`🎉 Mission complete! +${m.points} pts — ${m.title}`, 'success')
      })
    }
  }, []) // eslint-disable-line

  const sharedProps = { address, balance, network, connectWallet, disconnectWallet, showToast, setView, shortenAddr, paperSession, setPaperSession, theme, toggleTheme, onMissionComplete, totalPoints }

  return (
    <>
      <BackgroundCanvas theme={theme} />
      <div className="aura" aria-hidden="true">
        <div className="aura-blob aura-blob--purple" />
        <div className="aura-blob aura-blob--green" />
      </div>

      <div className="app-shell">
        {/* ── Pages ── */}
        {view === 'home'       && <Home        {...sharedProps} />}
        {view === 'whitepaper' && <Whitepaper  {...sharedProps} />}
        {view === 'askpaper'   && <AskPaper    {...sharedProps} />}
        {view === 'profile'    && <Profile     {...sharedProps} />}

        {/* ── Bottom Nav ── */}
        <nav className="bottom-nav">
          {[
            { id: 'home',       icon: '🏠', label: 'Home'  },
            { id: 'whitepaper', icon: '📄', label: 'Paper' },
            { id: 'askpaper',   icon: '💬', label: 'Ask'   },
            { id: 'profile',    icon: '👤', label: 'Me'    },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Toast ── */}
      <div className="toast-container">
        <div className={`toast ${toastVisible ? 'show' : ''} ${toastType}`}>
          {toastMsg}
        </div>
      </div>
    </>
  )
}
