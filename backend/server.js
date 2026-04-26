/* ─────────────────────────────────────────────────────
   NGL Paper — Backend Server
   Express + Vertex AI (Gemini) + PDF parsing + PDF generation
   ───────────────────────────────────────────────────── */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'
import { GoogleGenAI } from '@google/genai'
import { randomUUID } from 'crypto'
import PDFDocument from 'pdfkit'
import * as cheerio from 'cheerio'

const require   = createRequire(import.meta.url)
const pdfParse  = require('pdf-parse')
const Database  = require('better-sqlite3')

/* ── Config ──────────────────────────────────────────── */
const PORT               = process.env.PORT           || 3001
const PROJECT_ID         = process.env.GCP_PROJECT_ID
const LOCATION           = process.env.GCP_LOCATION   || 'us-central1'
const FREE_LIMIT         = parseInt(process.env.FREE_PAGE_LIMIT) || 15
const PRICE_PER_PAGE     = parseFloat(process.env.PRICE_PER_PAGE) || 0.01
const MODEL              = 'gemini-2.5-flash'
const EXPLAIN_MODEL      = 'gemini-2.5-flash'   // same model as chat, confirmed available
const PAYMENT_RECIPIENT  = process.env.PAYMENT_RECIPIENT || null   // Legacy fallback
const FLAT_FEE_USD       = 0.01                                    // $0.01 per explain
const CELO_RPC           = process.env.CELO_RPC || 'https://alfajores-forno.celo-testnet.org'

// Smart contract addresses per chain (set after deploying)
const CONTRACT_BY_CHAIN = {
  42220: process.env.CONTRACT_ADDRESS_MAINNET  || process.env.CONTRACT_ADDRESS || null,
  44787: process.env.CONTRACT_ADDRESS_ALFAJORES || process.env.CONTRACT_ADDRESS || null,
}

// cUSD ERC-20 addresses (canonical, no env needed)
const CUSD_BY_CHAIN = {
  42220: '0x765DE816845861e75A25fCA122bb6898B8B1282a', // Celo Mainnet
  44787: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', // Celo Alfajores
}

const PAYMENT_REQUIRED = !!(Object.values(CONTRACT_BY_CHAIN).some(Boolean) || PAYMENT_RECIPIENT)

const RPC_BY_CHAIN = {
  42220:    'https://forno.celo.org',
  44787:    'https://alfajores-forno.celo-testnet.org',
  1:        'https://eth.llamarpc.com',
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
}

/* ── Google GenAI via Vertex AI (service account) ────── */
const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
})

/* ── SQLite account store ───────────────────────────── */
const __dirname = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(__dirname, 'data'), { recursive: true })
const db = new Database(join(__dirname, 'data', 'ngl.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    address       TEXT PRIMARY KEY,
    created_at    INTEGER NOT NULL,
    default_mode  TEXT NOT NULL DEFAULT 'simply',
    default_lang  TEXT NOT NULL DEFAULT 'auto'
  );
  CREATE TABLE IF NOT EXISTS history (
    id         TEXT PRIMARY KEY,
    address    TEXT NOT NULL,
    title      TEXT,
    page_count INTEGER DEFAULT 0,
    mode       TEXT DEFAULT 'simply',
    language   TEXT DEFAULT 'auto',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id         TEXT PRIMARY KEY,
    address    TEXT,
    title      TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`)

function ensureAccount(address) {
  const exists = db.prepare('SELECT 1 FROM accounts WHERE address = ?').get(address)
  if (!exists) {
    db.prepare('INSERT INTO accounts (address, created_at) VALUES (?, ?)').run(address, Date.now())
  }
}

/* ── Token price cache ───────────────────────────────────── */
let _priceCache = { celo: null, eth: null, ts: 0 }
async function getTokenPrices() {
  const now = Date.now()
  if (_priceCache.celo && now - _priceCache.ts < 60_000) return _priceCache
  try {
    const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=celo,ethereum&vs_currencies=usd')
    const data = await res.json()
    _priceCache = { celo: data.celo.usd, eth: data.ethereum.usd, ts: now }
  } catch { _priceCache.ts = now }
  return _priceCache
}
async function getCeloUsdPrice() { return (await getTokenPrices()).celo || 0.45 }
async function getEthUsdPrice()  { return (await getTokenPrices()).eth  || 2000  }

const CELO_CHAINS = new Set([42220, 44787])  // chains where native token is CELO

// ERC-20 Transfer event topic (standard, constant)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/* ── Payment verification ───────────────────────────────── */
async function verifyPayment(txHash, pageCount = 1, chainId = 44787) {
  if (!PAYMENT_REQUIRED) return
  if (!txHash) throw new Error('Payment required: provide txHash')

  const rpc = RPC_BY_CHAIN[chainId] || CELO_RPC
  console.log(`[PAYMENT] Verifying ${txHash} on chain ${chainId} via ${rpc}`)

  const rpcPost = (method, params) =>
    fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    }).then(r => r.json())

  const { result: receipt } = await rpcPost('eth_getTransactionReceipt', [txHash])
  if (!receipt || receipt.status !== '0x1') throw new Error('Transaction not confirmed or failed')

  const { result: tx } = await rpcPost('eth_getTransactionByHash', [txHash])
  if (!tx) throw new Error('Transaction not found on chain')

  const contractAddr = CONTRACT_BY_CHAIN[chainId]
  const cUSDAddr     = CUSD_BY_CHAIN[chainId]

  if (contractAddr) {
    /* ── Contract mode ──────────────────────────────── */
    if (tx.to?.toLowerCase() !== contractAddr.toLowerCase())
      throw new Error('Payment not sent to NGLPaper contract')

    const sentWei = BigInt(tx.value || '0x0')

    if (sentWei === 0n) {
      /* cUSD payment: find Transfer(from, contract, amount) in logs */
      const contractPad = contractAddr.toLowerCase().replace('0x', '').padStart(64, '0')
      const cUSDLog = receipt.logs?.find(log =>
        log.address?.toLowerCase() === cUSDAddr?.toLowerCase() &&
        log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
        log.topics?.[2]?.toLowerCase().includes(contractPad)
      )
      if (!cUSDLog) throw new Error('cUSD Transfer to contract not found in logs')

      const paid    = BigInt(cUSDLog.data)
      const minCUSD = BigInt(Math.floor(PRICE_PER_PAGE * pageCount * 1e18 * 0.85))
      if (paid < minCUSD)
        throw new Error(`Insufficient cUSD: need ~$${(PRICE_PER_PAGE * pageCount).toFixed(4)} cUSD`)
    } else {
      /* Native CELO payment via contract */
      const prices      = await getTokenPrices()
      const nativePrice = prices.celo || 0.45
      const minWei      = BigInt(Math.floor((PRICE_PER_PAGE * pageCount * 0.85 / nativePrice) * 1e18))
      if (sentWei < minWei)
        throw new Error(`Insufficient CELO for ${pageCount} pages`)
    }
  } else if (PAYMENT_RECIPIENT) {
    /* ── Legacy mode: direct transfer ───────────────── */
    if (tx.to?.toLowerCase() !== PAYMENT_RECIPIENT.toLowerCase())
      throw new Error('Payment sent to wrong address')

    const prices      = await getTokenPrices()
    const nativePrice = CELO_CHAINS.has(chainId) ? (prices.celo || 0.45) : (prices.eth || 2000)
    const minWei      = BigInt(Math.floor((PRICE_PER_PAGE * pageCount * 0.85 / nativePrice) * 1e18))
    if (BigInt(tx.value) < minWei)
      throw new Error(`Insufficient payment for ${pageCount} pages`)
  }
}

/* ── In-memory session store ─────────────────────────── */
// Map: sessionId -> { filename, pageCount, text, history, createdAt }
const sessions = new Map()

// Clean up sessions older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id)
  }
}, 15 * 60 * 1000)

/* ── Multer (memory storage) ─────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are accepted'))
  },
})

/* ── Helper: build system prompt (document mode) ─────── */
function buildSystemPrompt(filename, pageCount, text) {
  return `You are **Dr. Paper**, a friendly and knowledgeable AI assistant specialized in explaining documents in plain, simple language. You were created by NGL Paper.

## Your Identity
- Your name is **Dr. Paper**
- You are warm, clear, and patient — like a smart friend who has read the document for you
- You never show off technical knowledge unnecessarily

## Language Rule (CRITICAL)
- **Detect the language the user is writing in and always respond in that exact same language.**
- If the user writes in Indonesian (Bahasa Indonesia), respond entirely in Indonesian.
- If the user writes in English, respond entirely in English.
- If the user mixes languages, follow the dominant language of their message.
- Never switch languages mid-conversation unless the user switches first.

## Scope Rule
- You are here to help the user understand the document: **"${filename}"** (${pageCount} pages).
- Answer questions that are **directly about the document** OR **about any concept, term, or topic that appears or is referenced in the document** — even if the question seems broader.
  - Example: If the document mentions "cryptography", and the user asks "what is cryptography?", answer it — because it's relevant context for understanding the document.
- If a question is completely unrelated to the document and no connection can reasonably be made, politely say so and redirect the user to ask about the document.
- Do NOT be overly strict. When in doubt, connect the question to the document context and answer helpfully.

## Answer Style
- NEVER use jargon without immediately explaining it simply (in parentheses or the next sentence)
- Always use real-world analogies to make concepts tangible (e.g., "think of it like a receipt from a vending machine")
- Keep answers concise but complete — users are on mobile, so avoid walls of text
- Use **bold** for key terms the first time they appear
- For complex topics, break the explanation into short numbered steps
- Be honest about risks, limitations, or uncertainties mentioned in the document

## Document Content
The following is the extracted text from "${filename}" (${pageCount} pages). Use this as your primary knowledge source:

───────────────────
${text}
───────────────────

Always ground your answers in this document. If something isn't covered in the document, say so honestly and offer what general context you can based on related terms from the document.`
}

/* ── Helper: build system prompt (general mode) ──────── */
function buildGeneralSystemPrompt() {
  return `You are **Dr. Paper**, a friendly and knowledgeable AI assistant specialized in crypto, blockchain, and Web3 — created by NGL Paper.

## Your Identity
- Your name is **Dr. Paper**
- You are warm, clear, and genuinely excited about helping people understand crypto and blockchain
- You speak like a knowledgeable friend, not a textbook
- You never show off technical knowledge unnecessarily

## Language Rule (CRITICAL)
- **Detect the language the user is writing in and always respond in that exact same language.**
- If the user writes in Indonesian (Bahasa Indonesia), respond entirely in Indonesian.
- If the user writes in English, respond entirely in English.
- If the user mixes languages, follow the dominant language of their message.
- Never switch languages mid-conversation unless the user switches first.

## What You Can Help With
- Any topic related to **crypto, blockchain, and Web3**: Bitcoin, Ethereum, Celo, DeFi, NFTs, smart contracts, tokenomics, consensus mechanisms, wallets, security, regulations, and more.
- Explaining complex whitepapers, technical concepts, and industry trends in plain language.
- Discussing investment risks, project fundamentals, and market dynamics (always with appropriate disclaimers).
- Helping users understand any document or project they describe — even without the PDF.

## Answer Style
- NEVER use jargon without immediately explaining it in simple terms
- Always use real-world analogies to make concepts tangible (e.g., "think of a blockchain like a shared Google Sheet that no one can secretly edit")
- Keep answers concise but complete — users are on mobile, so avoid walls of text
- Use **bold** for key terms the first time they appear
- For complex topics, break the explanation into short numbered steps or bullet points
- Be honest about risks, limitations, and uncertainties
- Add a disclaimer when discussing investment topics: remind users to do their own research

## Scope
- You are an expert in crypto and blockchain. You can also discuss adjacent topics (economics, technology, regulation) when relevant.
- If a question is completely unrelated to crypto/blockchain/Web3/finance/technology, politely say so and offer to help with a related topic instead.`
}

/* ── Express app ─────────────────────────────────────── */
const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '50mb' }))

/* ────────────────────────────────────────────────────────
   POST /api/upload
   Accepts: multipart PDF file
   Returns: { sessionId, filename, pageCount, isFree, extraPages, estimatedCost }
   ──────────────────────────────────────────────────────── */
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file provided' })

  try {
    const data = await pdfParse(req.file.buffer)
    const pageCount = data.numpages
    const text      = data.text.trim()
    const filename  = req.file.originalname.replace(/\.pdf$/i, '')

    // Calculate pricing
    const isFree       = pageCount <= FREE_LIMIT
    const extraPages   = Math.max(0, pageCount - FREE_LIMIT)
    const estimatedCost = (extraPages * PRICE_PER_PAGE).toFixed(2)

    // For paid tier (future): only use first FREE_LIMIT pages if > limit
    // For now (payment skipped): use full text, just show the banner
    const textToUse = isFree
      ? text
      : truncateToPages(text, pageCount, FREE_LIMIT)  // limit context to first 15 pages

    const sessionId = randomUUID()
    sessions.set(sessionId, {
      filename,
      pageCount,
      fullText: text,
      text: textToUse,    // what AI sees (limited if paid tier)
      history: [],
      isFree,
      extraPages,
      estimatedCost,
      createdAt: Date.now(),
    })

    console.log(`[UPLOAD] ${filename} — ${pageCount} pages — session ${sessionId}`)

    res.json({
      sessionId,
      filename,
      pageCount,
      isFree,
      extraPages,
      estimatedCost,
      freeLimit: FREE_LIMIT,
    })
  } catch (err) {
    console.error('[UPLOAD ERROR]', err)
    res.status(500).json({ error: 'Failed to parse PDF: ' + err.message })
  }
})

/* ────────────────────────────────────────────────────────
   POST /api/ask
   Body: { sessionId, question }
   Returns: { answer, history }
   ──────────────────────────────────────────────────────── */
app.post('/api/ask', async (req, res) => {
  const { sessionId, question } = req.body

  if (!sessionId || !question?.trim()) {
    return res.status(400).json({ error: 'sessionId and question are required' })
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired. Please re-upload your PDF.' })
  }

  try {
    const systemPrompt = session.isGeneral
      ? buildGeneralSystemPrompt()
      : buildSystemPrompt(session.filename, session.pageCount, session.text)

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        ...session.history,
        { role: 'user', parts: [{ text: question.trim() }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024,
        temperature: 0.4,
        topP: 0.8,
      },
    })

    const answer = response.text

    // Update history in session
    session.history.push(
      { role: 'user',  parts: [{ text: question.trim() }] },
      { role: 'model', parts: [{ text: answer }] },
    )
    // Keep history trimmed to last 10 exchanges (20 messages)
    if (session.history.length > 20) {
      session.history = session.history.slice(-20)
    }

    console.log(`[ASK] session=${sessionId} q="${question.slice(0,60)}..."`)

    res.json({ answer })
  } catch (err) {
    console.error('[ASK ERROR]', err)
    res.status(500).json({ error: 'AI failed to respond: ' + (err.message || 'Unknown error') })
  }
})

/* ── POST /api/session/general — Create a general chat session ── */
app.post('/api/session/general', (req, res) => {
  const sessionId = randomUUID()
  sessions.set(sessionId, {
    filename:      null,
    pageCount:     null,
    text:          null,
    history:       [],
    isFree:        true,
    extraPages:    0,
    estimatedCost: '0.00',
    isGeneral:     true,
    createdAt:     Date.now(),
  })
  console.log(`[GENERAL SESSION] created ${sessionId}`)
  res.json({ sessionId, isGeneral: true })
})

/* ── GET /api/session/:id — Check session status ─────── */
app.get('/api/session/:id', (req, res) => {
  const session = sessions.get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  const { filename, pageCount, isFree, extraPages, estimatedCost, isGeneral } = session
  res.json({ filename, pageCount, isFree, extraPages, estimatedCost, isGeneral, messageCount: session.history.length / 2 })
})

/* ── GET / ───────────────────────────────────────────── */
app.get('/', (_, res) => {
  res.json({ name: 'NGL Paper Backend', status: 'ok', model: MODEL })
})

/* ── GET /api/health ─────────────────────────────────── */
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', project: PROJECT_ID, model: MODEL, sessions: sessions.size })
})

/* ── Helpers ─────────────────────────────────────────── */
// Rough approximation: limit text to first N pages (by character ratio)
function truncateToPages(fullText, totalPages, limitPages) {
  const ratio = limitPages / totalPages
  const limit = Math.floor(fullText.length * ratio)
  return fullText.slice(0, limit) + `\n\n[Note: Only the first ${limitPages} pages are included in this response. Upgrade to access the full document.]`
}

/* ── Helper: strip emoji (pdfkit/Helvetica cannot render Unicode emoji) ── */
function stripEmoji(str = '') {
  return str
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Emoji & symbols block
    .replace(/[\u{2600}-\u{26FF}]/gu, '')      // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')      // Dingbats
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')      // Variation selectors
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')    // Misc emoji
    .replace(/\s{2,}/g, ' ')                    // Collapse extra spaces
    .trim()
}

/* ── Helper: string-aware bracket depth tracker ────── */
function scanDepths(text) {
  // Returns array of { pos, depth } for every { or } outside strings
  const events = []
  let depth = 0, inStr = false, esc = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (esc)          { esc = false; continue }
    if (ch === '\\'  && inStr) { esc = true; continue }
    if (ch === '"')   { inStr = !inStr; continue }
    if (inStr)        continue
    if (ch === '{')   { depth++; events.push({ pos: i, depth, type: 'open' }) }
    else if (ch === '}') { events.push({ pos: i, depth, type: 'close' }); depth-- }
  }
  return { events, finalDepth: depth }
}

/* ── Helper: robustly extract JSON from AI response ──── */
function extractJSON(raw = '') {
  // 1. Strip markdown fences
  let text = raw.trim()
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

  // 2. Try direct parse first
  try { return JSON.parse(text) } catch (_) {}

  // 3. Extract the outermost {...} block
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch (_) {}
  }

  // 4. JSON was likely truncated — find last complete section using string-aware scan
  if (start !== -1) {
    const slice = text.slice(start)
    const { events } = scanDepths(slice)
    // Find the last closing brace at depth 2 (section object inside sections array inside root)
    // root={depth1}, sections=[...], section={depth2}
    let lastSectionEnd = -1
    for (const ev of events) {
      if (ev.type === 'close' && ev.depth === 2) lastSectionEnd = ev.pos
    }
    if (lastSectionEnd > 0) {
      // Truncate after the last complete section
      const partial = slice.slice(0, lastSectionEnd + 1)
      // Now close: sections array ] and root object }
      try { return JSON.parse(partial + ']}') } catch (_) {}
      try { return JSON.parse(partial + '\n  ]\n}') } catch (_) {}
    }
    // Fallback: close any open structures at root level
    const { finalDepth: fd } = scanDepths(slice)
    let repaired = slice
    for (let i = 0; i < fd; i++) repaired += '}'
    try { return JSON.parse(repaired) } catch (_) {}
  }

  // 5. Failed
  throw new Error('Could not extract valid JSON from AI response')
}

/* ── Helper: build explain prompt (Overview mode) ────── */
function buildExplainPrompt(filename, pageCount, text, language = 'auto') {
  const langInstruction = language === 'english'
    ? 'Write ALL values in the JSON in English.'
    : language === 'indonesian'
    ? 'Tulis SEMUA nilai dalam JSON dalam Bahasa Indonesia.'
    : 'Detect the language of the document; write all JSON values in that language'

  return `You are Dr. Paper. Your job is to give a clear, friendly OVERVIEW of a document — like explaining it to a smart friend over coffee. Keep it short, engaging, and jargon-free.

OVERVIEW MODE RULES:
1. Be concise — this is a quick overview, not a deep dive.
2. Focus only on the 4-5 most important ideas in the document.
3. Use everyday language. Avoid jargon. If a technical term is needed, explain it in one simple sentence.
4. Each section should feel like a short, punchy insight — not an essay.
5. The goal: reader understands the big picture in under 3 minutes.

Respond with ONLY a valid JSON object — no markdown, no text outside JSON.

JSON structure:
{
  "title": "exact document title",
  "author": "author name(s) or Unknown",
  "language": "detected output language",
  "tldr": "2-3 casual sentences: what this is, what problem it solves, and why it matters — written like a tweet thread",
  "sections": [
    {
      "heading": "Short punchy section title",
      "simple_explanation": "2-3 sentences explaining this idea in plain English — no jargon, like talking to a friend",
      "detailed_explanation": "3-4 sentences adding a bit more context — use 1 real-world analogy to make it click",
      "key_terms": [
        { "term": "TechnicalTerm", "meaning": "One sentence plain definition", "analogy": "One relatable comparison" }
      ],
      "core_summary": "1 sentence: the single most important thing to remember from this section"
    }
  ]
}

Sections (pick the 4-5 most important — do NOT force-include everything):
- What Is This
- The Problem It Solves
- How It Works (the core idea only)
- What Makes It Unique
- Should You Care? (who benefits & key risk)

${langInstruction}
Output ONLY the JSON object.

Document: "${filename}" (${pageCount} pages)
---
${text.slice(0, 18000)}
---`
}

/* ── Helper: build explain prompt (Full Analysis mode) ── */
function buildFullExplainPrompt(filename, pageCount, text, language = 'auto') {
  const langInstruction = language === 'english'
    ? 'Write ALL values in the JSON in English.'
    : language === 'indonesian'
    ? 'Tulis SEMUA nilai dalam JSON dalam Bahasa Indonesia.'
    : 'Detect the language of the document; write all JSON values in that language'

  return `You are Dr. Paper, a world-class analyst who produces THOROUGH yet EASY-TO-UNDERSTAND breakdowns of complex documents. Your Full Analysis is like a consultant briefing — comprehensive, precise, but always clear.

FULL ANALYSIS MODE RULES:
1. Cover EVERY major topic, mechanism, number, and claim in the document — nothing skipped.
2. For each section: first explain it simply (so anyone understands), then dive deep (so an expert is satisfied).
3. Every technical term must be defined in plain words AND linked to a real-world analogy.
4. Use a layered approach: simple first, detailed second — readers can stop at the simple layer or go deeper.
5. Preserve exact numbers, percentages, formulas, and technical names — never round or generalize.
6. Be comprehensive but never boring — each sentence must add value.

Respond with ONLY a valid JSON object — no markdown, no text outside JSON.

JSON structure:
{
  "title": "exact document title",
  "author": "author name(s) or Unknown",
  "language": "detected output language",
  "tldr": "4-5 sentences: what this is, the exact problem it addresses, its core solution and how it works technically, the key innovation, and who benefits most",
  "sections": [
    {
      "heading": "Clear descriptive section title",
      "simple_explanation": "3-4 sentences — plain language that a non-technical person can read and fully grasp, no jargon",
      "detailed_explanation": "6-8 sentences — technical depth with specific details, numbers, mechanisms, and 2+ real-world analogies. Show HOW and WHY it works at the implementation level.",
      "key_terms": [
        { "term": "ExactTechnicalTerm", "meaning": "Precise plain-words definition", "analogy": "Concrete real-world comparison that makes it immediately intuitive" }
      ],
      "core_summary": "2 sentences: the essential technical takeaway and its real-world implication"
    }
  ]
}

Required sections (8-12 — cover ALL major topics from the document):
- Background & What This Is
- The Problem Being Solved (cite specific pain points and numbers from the doc)
- The Proposed Solution & Core Architecture
- How It Works — Step by Step
- Key Technology & Technical Mechanisms
- What Makes It Unique (innovation vs. existing solutions)
- Token Economics & Incentives (if present)
- Governance & Decentralization (if present)
- Security Model & Trust Assumptions
- Real-World Use Cases
- Risks, Limitations & Trade-offs
- Final Verdict & Key Takeaway

${langInstruction}
Output ONLY the JSON object.

Document: "${filename}" (${pageCount} pages)
---
${text.slice(0, 28000)}
---`
}

/* ── Helper: generate explanation PDF with pdfkit ────── */
function generateExplanationPDF(explanation, filename) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true, bufferPages: true })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const DARK   = '#0A0A15'
    const GOLD   = '#B45309'
    const MUTED  = '#6B7280'
    const WHITE  = '#FFFFFF'
    const pageW  = doc.page.width
    const pageH  = doc.page.height
    const L = 50, R = pageW - 50, W = R - L

    const safe = s => stripEmoji(String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' '))
    const checkPage = (needed = 140) => { if (doc.y > pageH - needed) { doc.addPage(); doc.y = 50 } }

    /* Draw a coloured label strip then body text below it */
    const drawSection = (label, labelBg, labelFg, bodyStr, indent = 8) => {
      if (!bodyStr) return
      const text = safe(bodyStr)
      checkPage(80)
      const stripY = doc.y
      doc.rect(L, stripY, W, 15).fill(labelBg)
      doc.fontSize(7).fillColor(labelFg).font('Helvetica-Bold')
         .text(label, L + indent, stripY + 4, { width: W - indent * 2, characterSpacing: 0.6 })
      doc.y = stripY + 15 + 4
      doc.fontSize(9.5).fillColor('#1F2937').font('Helvetica')
         .text(text, L + indent, doc.y, { width: W - indent * 2, lineGap: 3, align: 'justify' })
      doc.moveDown(0.6)
    }

    // ── COVER HEADER ────────────────────────────
    doc.rect(0, 0, pageW, 120).fill(DARK)
    doc.fontSize(9).fillColor(GOLD).font('Helvetica-Bold')
       .text('NGL PAPER', L, 24, { characterSpacing: 2 })
    doc.fontSize(7.5).fillColor('#9CA3AF').font('Helvetica')
       .text('AI-Powered Document Explanation  ·  Dr. Paper', L, 38)
    // Title
    const title = safe(explanation.title || filename)
    doc.fontSize(title.length > 60 ? 13 : 16).fillColor(WHITE).font('Helvetica-Bold')
       .text(title, L, 56, { width: W, lineGap: 4 })
    doc.y = 132

    // Author / language meta
    doc.fontSize(8.5).fillColor(MUTED).font('Helvetica')
       .text(`Author: ${safe(explanation.author || 'Unknown')}   ·   Language: ${explanation.language || 'English'}`, L)
    doc.moveDown(0.5)
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
    doc.moveDown(1)

    // ── TL;DR BOX ───────────────────────────────
    checkPage(100)
    const tldrText = safe(explanation.tldr || '')
    const tldrBoxY = doc.y
    // Estimate lines (~90 chars per line at 9.5pt in W-24 px)
    const tldrLines = Math.max(2, Math.ceil(tldrText.length / 90))
    const tldrH = 14 + 6 + tldrLines * 14 + 12
    doc.rect(L, tldrBoxY, W, tldrH).fill('#FFFBEB')
    doc.moveTo(L, tldrBoxY).lineTo(L, tldrBoxY + tldrH).lineWidth(4).strokeColor(GOLD).stroke()
    doc.fontSize(7.5).fillColor(GOLD).font('Helvetica-Bold')
       .text('TL;DR', L + 14, tldrBoxY + 8, { characterSpacing: 0.8 })
    doc.fontSize(9.5).fillColor('#78350F').font('Helvetica')
       .text(tldrText, L + 14, tldrBoxY + 24, { width: W - 28, lineGap: 3, align: 'justify' })
    doc.y = tldrBoxY + tldrH + 16

    // ── SECTION HEADER ──────────────────────────
    doc.fontSize(7.5).fillColor(MUTED).font('Helvetica-Bold')
       .text('SECTION BREAKDOWN', L, doc.y, { characterSpacing: 1.5 })
    doc.moveDown(0.8)

    // ── SECTIONS ────────────────────────────────
    const sections = explanation.sections || []
    sections.forEach((sec, idx) => {
      checkPage(220)

      // Section number + heading bar
      const hY = doc.y
      doc.rect(L, hY, W, 24).fill(DARK)
      doc.rect(L, hY, 4, 24).fill(GOLD)
      doc.fontSize(8).fillColor(GOLD).font('Helvetica-Bold')
         .text(String(idx + 1).padStart(2, '0'), L + 10, hY + 8)
      doc.fontSize(10.5).fillColor(WHITE).font('Helvetica-Bold')
         .text(safe(sec.heading || `Section ${idx + 1}`), L + 30, hY + 7, { width: W - 36 })
      doc.y = hY + 30

      // 1. Simple Explanation
      if (sec.simple_explanation) {
        drawSection('SIMPLE EXPLANATION', '#ECFDF5', '#065F46', sec.simple_explanation)
      }

      // 2. Detailed Explanation
      if (sec.detailed_explanation) {
        drawSection('IN DEPTH', '#EFF6FF', '#1E40AF', sec.detailed_explanation)
      }

      // 3. Key Terms
      if (sec.key_terms?.length) {
        checkPage(60)
        const ktY = doc.y
        doc.rect(L, ktY, W, 15).fill('#FEF3C7')
        doc.fontSize(7).fillColor('#92400E').font('Helvetica-Bold')
           .text('KEY TERMS', L + 8, ktY + 4, { characterSpacing: 0.6 })
        doc.y = ktY + 15 + 4

        sec.key_terms.forEach(kt => {
          checkPage(50)
          doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold')
             .text(safe(kt.term) + ':', L + 8, doc.y, { continued: true, width: W - 16 })
          doc.font('Helvetica').fillColor('#374151')
             .text('  ' + safe(kt.meaning), { continued: false })
          if (kt.analogy) {
            doc.fontSize(8.5).fillColor('#6B7280').font('Helvetica')
               .text('Example: ' + safe(kt.analogy), L + 16, doc.y, { width: W - 24, lineGap: 2 })
          }
          doc.moveDown(0.35)
        })
        doc.moveDown(0.3)
      }

      // 4. Core Summary
      if (sec.core_summary) {
        checkPage(60)
        const csY = doc.y
        const csText = safe(sec.core_summary)
        const csLines = Math.max(1, Math.ceil(csText.length / 90))
        const csH = 14 + 6 + csLines * 14 + 10
        doc.rect(L, csY, W, csH).fill('#F5F3FF')
        doc.moveTo(L, csY).lineTo(L, csY + csH).lineWidth(3).strokeColor('#8B5CF6').stroke()
        doc.fontSize(7).fillColor('#8B5CF6').font('Helvetica-Bold')
           .text('KEY TAKEAWAY', L + 12, csY + 4, { characterSpacing: 0.6 })
        doc.fontSize(9.5).fillColor('#4C1D95').font('Helvetica')
           .text(csText, L + 12, csY + 18, { width: W - 22, lineGap: 3 })
        doc.y = csY + csH + 12
      }

      doc.moveDown(0.6)
    })

    // ── FOOTER ──────────────────────────────────
    checkPage(50)
    doc.moveDown(0.5)
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
    doc.moveDown(0.6)
    doc.fontSize(7.5).fillColor(MUTED).font('Helvetica')
       .text('Generated by NGL Paper · Dr. Paper AI · For educational purposes only · Always verify from the original source.',
             L, doc.y, { width: W, align: 'center', lineGap: 2 })
    doc.end()
  })
}

function estimateCardHeight(body = '') {
  // ~60 chars per line at 9.5pt in 390px wide column
  const lines = Math.ceil((body.length || 0) / 60)
  return 36 + Math.max(lines, 1) * 14
}

/* ────────────────────────────────────────────────────────
   POST /api/explain
   Accepts: multipart PDF file
   Returns: application/pdf (downloadable explanation)
   ──────────────────────────────────────────────────────── */
app.post('/api/explain', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file provided' })

  try {
    // 1. Parse PDF text
    const data      = await pdfParse(req.file.buffer)
    const pageCount = data.numpages

    // 0. Verify payment (after knowing page count)
    const chainId = parseInt(req.body.chainId) || 44787
    try { await verifyPayment(req.body.txHash, pageCount, chainId) } catch (e) { return res.status(402).json({ error: e.message }) }
    const text      = data.text.trim()
    const filename  = req.file.originalname.replace(/\.pdf$/i, '')

    console.log(`[EXPLAIN] ${filename} — ${pageCount} pages`)

    // 2. Call Gemini for structured explanation
    const mode     = req.body.mode     || 'simply'
    const language = req.body.language || 'auto'
    const prompt = mode === 'full'
      ? buildFullExplainPrompt(filename, pageCount, text, language)
      : buildExplainPrompt(filename, pageCount, text, language)
    const timeoutMs = mode === 'full' ? 250000 : 150000
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs/1000}s`)), timeoutMs))
    const aiResponse = await Promise.race([ai.models.generateContent({
      model: EXPLAIN_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: mode === 'full' ? 32768 : 16000,
        temperature: 0.2,
        topP: 0.85,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }), timeout])

    // 3. Parse JSON from AI response (robust extraction)
    console.log(`[EXPLAIN] AI response length: ${aiResponse.text?.length} chars`)
    let explanation
    try {
      explanation = extractJSON(aiResponse.text)
    } catch (parseErr) {
      console.error('[EXPLAIN] JSON parse failed, chars:', aiResponse.text?.length, ':', aiResponse.text?.slice(0, 400))
      return res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' })
    }

    // 4. Generate PDF
    const pdfBuffer = await generateExplanationPDF(explanation, filename)
    const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60)

    // 5. Create ask-session for follow-up Q&A
    const sessionId = randomUUID()
    sessions.set(sessionId, { filename, pageCount, text, history: [], isFree: true, extraPages: 0, estimatedCost: '0.00', isGeneral: false, createdAt: Date.now() })

    // 6. Return JSON with explanation data + base64 PDF + sessionId
    res.json({
      explanation,
      pageCount,
      pdfBase64:  pdfBuffer.toString('base64'),
      filename:   `${safeFilename}_explained.pdf`,
      sessionId,
    })

    console.log(`[EXPLAIN] Done — ${filename} — PDF ${pdfBuffer.length} bytes — session ${sessionId}`)
  } catch (err) {
    console.error('[EXPLAIN ERROR]', err)
    res.status(500).json({ error: 'Failed to explain paper: ' + err.message })
  }
})

/* ────────────────────────────────────────────────────────
   POST /api/explain-url
   Body: { url: string }
   Handles: Direct PDF URLs + GitBook/HTML doc pages
   Returns: application/pdf (downloadable explanation)
   ──────────────────────────────────────────────────────── */
app.post('/api/explain-url', express.json(), async (req, res) => {
  const { url, mode = 'simply', language = 'auto', txHash, chainId: rawChainId, clientPageCount } = req.body
  const chainId = parseInt(rawChainId) || 44787
  if (!url?.trim()) return res.status(400).json({ error: 'URL is required' })

  let parsedUrl
  try { parsedUrl = new URL(url.trim()) } catch (_) {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  try {
    console.log(`[EXPLAIN-URL] Fetching: ${url}`)

    // ── 1. Fetch the URL ──────────────────────────────────
    const fetchResp = await fetch(url.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NGLPaperBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    })

    if (!fetchResp.ok) {
      return res.status(400).json({ error: `Could not fetch URL: HTTP ${fetchResp.status}` })
    }

    const contentType = fetchResp.headers.get('content-type') || ''
    let text = ''
    let filename = parsedUrl.hostname + parsedUrl.pathname.replace(/\//g, '_').replace(/_+$/, '') || 'document'
    let pageCount = 1

    // ── 2a. Direct PDF URL ────────────────────────────────
    if (contentType.includes('application/pdf') || url.trim().toLowerCase().endsWith('.pdf')) {
      const pdfBuffer = Buffer.from(await fetchResp.arrayBuffer())
      const data = await pdfParse(pdfBuffer)
      text = data.text.trim()
      pageCount = data.numpages
      filename = parsedUrl.pathname.split('/').pop().replace(/\.pdf$/i, '') || filename
      console.log(`[EXPLAIN-URL] PDF detected — ${pageCount} pages`)

    // ── 2b. HTML page (GitBook, docs, etc.) ───────────────
    } else {
      const html = await fetchResp.text()

      /* ── Helper: extract main content text from an HTML string ── */
      const extractPageText = (rawHtml) => {
        const $p = cheerio.load(rawHtml)
        // Collect sidebar links BEFORE removing nav (used by crawler below)
        const navLinks = new Set()
        const baseOrigin = parsedUrl.origin
        $p('nav a, aside a, [role="navigation"] a, [role="complementary"] a, ' +
           '.sidebar a, .toc a, .menu a, .table-of-contents a, ' +
           '[data-testid*="sidebar"] a, [data-testid*="navigation"] a, ' +
           '[data-testid*="table-of-contents"] a, .gitbook-sidebar a').each((_, el) => {
          const href = $p(el).attr('href')
          if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
          try {
            const abs = new URL(href, url.trim()).href.split('#')[0]
            if (abs.startsWith(baseOrigin)) navLinks.add(abs)
          } catch {}
        })
        // Remove noise
        $p('script, style, nav, footer, header, [role="navigation"], [role="complementary"], ' +
           '.sidebar, .toc, .menu, .navbar, noscript, iframe, svg').remove()
        // Content selectors (most specific → least)
        const selectors = [
          '[data-testid="page.contentEditor"]',
          '.gitbook-root', '.markdown-section', '.page-inner',
          'article', 'main', '.content', '.documentation', '.prose', '#content', 'body',
        ]
        for (const sel of selectors) {
          const el = $p(sel)
          if (el.length && el.text().trim().length > 200) {
            return { text: el.text().trim(), navLinks }
          }
        }
        return { text: '', navLinks }
      }

      /* ── Fetch a single page safely ── */
      const fetchPage = async (pageUrl) => {
        try {
          const r = await fetch(pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NGLPaperBot/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
          })
          if (!r.ok || (r.headers.get('content-type') || '').includes('pdf')) return ''
          return await r.text()
        } catch { return '' }
      }

      /* ── Extract first page + collect nav links ── */
      const { text: firstText, navLinks } = extractPageText(html)

      /* ── Crawl sub-pages found in sidebar (max 18 pages) ── */
      const visited   = new Set([url.trim().split('#')[0]])
      const subPages  = [...navLinks].filter(u => !visited.has(u)).slice(0, 18)
      const allParts  = []

      if (firstText.length > 100) allParts.push(firstText)

      if (subPages.length > 0) {
        console.log(`[EXPLAIN-URL] Crawling ${subPages.length} sub-pages from sidebar`)
        const CHAR_LIMIT = 44000
        for (const subUrl of subPages) {
          if (allParts.join('\n\n').length >= CHAR_LIMIT) break
          visited.add(subUrl)
          const subHtml = await fetchPage(subUrl)
          if (!subHtml) continue
          const { text: subText } = extractPageText(subHtml)
          if (subText.length > 100) {
            allParts.push(`\n\n---\n${subText}`)
            console.log(`[EXPLAIN-URL] + sub-page ${subUrl} (${subText.length} chars)`)
          }
        }
      }

      const combined = allParts.join('\n\n')
      if (combined.length < 100) {
        return res.status(400).json({
          error: 'Could not extract enough text from this URL. Try a direct PDF link instead.'
        })
      }

      text = combined
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\t/g, ' ')
        .slice(0, 44000)

      console.log(`[EXPLAIN-URL] Total extracted: ${text.length} chars from ${allParts.length} page(s)`)

      // Estimate page count (~250 words/page)
      const wordCount = text.split(/\s+/).length
      pageCount = Math.max(1, Math.ceil(wordCount / 250))
    }

    // 0. Verify payment — use clientPageCount (what user was shown and paid for)
    const verifyPages = clientPageCount ? parseInt(clientPageCount) : pageCount
    try { await verifyPayment(txHash, verifyPages, chainId) } catch (e) { return res.status(402).json({ error: e.message }) }

    // ── 3. Call Gemini for structured explanation ─────────
    const prompt = mode === 'full'
      ? buildFullExplainPrompt(filename, pageCount, text, language)
      : buildExplainPrompt(filename, pageCount, text, language)
    const timeoutMs2 = mode === 'full' ? 250000 : 150000
    const timeout2 = new Promise((_, reject) => setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs2/1000}s`)), timeoutMs2))
    const aiResponse = await Promise.race([ai.models.generateContent({
      model: EXPLAIN_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { maxOutputTokens: mode === 'full' ? 32768 : 16000, temperature: 0.2, topP: 0.85, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }), timeout2])

    // ── 4. Parse JSON (robust extraction) ────────────────
    console.log(`[EXPLAIN-URL] AI response length: ${aiResponse.text?.length} chars`)
    let explanation
    try {
      explanation = extractJSON(aiResponse.text)
    } catch (parseErr) {
      console.error('[EXPLAIN-URL] JSON parse failed, chars:', aiResponse.text?.length, ':', aiResponse.text?.slice(0, 400))
      return res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' })
    }

    // ── 5. Generate PDF ───────────────────────────────────
    const pdfBuffer = await generateExplanationPDF(explanation, filename)
    const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60)

    // ── 6. Create ask-session for follow-up Q&A
    const sessionId = randomUUID()
    sessions.set(sessionId, { filename, pageCount, text, history: [], isFree: true, extraPages: 0, estimatedCost: '0.00', isGeneral: false, createdAt: Date.now() })

    res.json({
      explanation,
      pageCount,
      pdfBase64:  pdfBuffer.toString('base64'),
      filename:   `${safeFilename}_explained.pdf`,
      sessionId,
    })

    console.log(`[EXPLAIN-URL] Done — ${filename} — PDF ${pdfBuffer.length} bytes — session ${sessionId}`)
  } catch (err) {
    console.error('[EXPLAIN-URL ERROR]', err)
    res.status(500).json({ error: 'Failed to explain URL: ' + err.message })
  }
})

/* ── GET /api/prices ──────────────────────────────────── */
app.get('/api/prices', async (req, res) => {
  const p = await getTokenPrices()
  res.json({ celo: p.celo || 0.45, eth: p.eth || 2000 })
})
app.get('/api/celo-price', async (req, res) => {   // backwards compat
  const p = await getTokenPrices()
  res.json({ usd: p.celo || 0.45, eth: p.eth || 2000 })
})

/* ── GET /api/config ─────────────────────────────────── */
app.get('/api/config', (req, res) => {
  res.json({
    paymentRecipient:    PAYMENT_RECIPIENT,
    paymentRequired:     PAYMENT_REQUIRED,
    feeUsd:              FLAT_FEE_USD,
    contractByChain:     CONTRACT_BY_CHAIN,
    cUSDByChain:         CUSD_BY_CHAIN,
  })
})

/* ── GET /api/chats/:address ────────────────────────── */
app.get('/api/chats/:address', (req, res) => {
  const sessions = db.prepare(
    'SELECT * FROM chat_sessions WHERE address = ? ORDER BY updated_at DESC LIMIT 30'
  ).all(req.params.address)
  res.json(sessions)
})

/* ── GET /api/chats/:address/:chatId ────────────────── */
app.get('/api/chats/:address/:chatId', (req, res) => {
  const msgs = db.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(req.params.chatId)
  res.json(msgs)
})

/* ── POST /api/chats/:address ────────────────────────── */
app.post('/api/chats/:address', express.json(), (req, res) => {
  const { address } = req.params
  const { title }   = req.body
  const id  = randomUUID()
  const now = Date.now()
  db.prepare('INSERT INTO chat_sessions (id, address, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    id, address, title || 'New Chat', now, now
  )
  res.json({ id })
})

/* ── POST /api/chats/:address/:chatId/messages ───────── */
app.post('/api/chats/:address/:chatId/messages', express.json(), (req, res) => {
  const { chatId } = req.params
  const { role, text } = req.body
  const id  = randomUUID()
  const now = Date.now()
  db.prepare('INSERT INTO chat_messages (id, session_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id, chatId, role, text, now
  )
  db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, chatId)
  res.json({ id })
})

/* ── GET /api/account/:address ──────────────────────── */
app.get('/api/account/:address', (req, res) => {
  const { address } = req.params
  ensureAccount(address)
  const account = db.prepare('SELECT * FROM accounts WHERE address = ?').get(address)
  const history = db.prepare('SELECT * FROM history WHERE address = ? ORDER BY created_at DESC LIMIT 50').all(address)
  const stats   = db.prepare('SELECT COUNT(*) as total_papers, COALESCE(SUM(page_count),0) as total_pages FROM history WHERE address = ?').get(address)
  res.json({ ...account, history, stats })
})

/* ── POST /api/account/:address/history ──────────────── */
app.post('/api/account/:address/history', express.json(), (req, res) => {
  const { address } = req.params
  const { title, page_count, mode, language } = req.body
  ensureAccount(address)
  const id = randomUUID()
  db.prepare('INSERT INTO history (id, address, title, page_count, mode, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, address, title || 'Untitled', page_count || 0, mode || 'simply', language || 'auto', Date.now()
  )
  res.json({ id, success: true })
})

/* ── PATCH /api/account/:address/preferences ─────────── */
app.patch('/api/account/:address/preferences', express.json(), (req, res) => {
  const { address } = req.params
  const { default_mode, default_lang } = req.body
  ensureAccount(address)
  db.prepare('UPDATE accounts SET default_mode = ?, default_lang = ? WHERE address = ?').run(
    default_mode || 'simply', default_lang || 'auto', address
  )
  res.json({ success: true })
})

/* ── Start ───────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  NGL Paper Backend — Running             ║
║  Port    : ${PORT}                          ║
║  Project : ${PROJECT_ID}      ║
║  Model   : ${MODEL}     ║
║  Free    : ${FREE_LIMIT} pages / $${PRICE_PER_PAGE}/page after  ║
╚══════════════════════════════════════════╝
  `)
})
