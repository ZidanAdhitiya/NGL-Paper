// Quick debug: test what Gemini actually returns
import 'dotenv/config'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION || 'us-central1',
})

const prompt = `Analyze this document and respond with ONLY a valid JSON object — no other text, no markdown.

Required JSON structure:
{
  "title": "exact document title",
  "author": "author name(s) or Unknown",
  "language": "English or Indonesian",
  "tldr": "2-3 sentence plain summary",
  "sections": [
    { "heading": "What Is This", "body": "explanation" }
  ]
}

Document: "Test Doc" (2 pages)
---
This is a test document about blockchain technology. Blockchain is a distributed ledger.
---`

console.log('Testing WITH responseMimeType: application/json ...')
try {
  const r1 = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 1024, temperature: 0.2, responseMimeType: 'application/json' },
  })
  console.log('RAW RESPONSE (with mimeType):\n', r1.text.slice(0, 500))
  JSON.parse(r1.text)
  console.log('✅ Valid JSON with responseMimeType')
} catch(e) {
  console.log('❌ Failed with responseMimeType:', e.message)
}

console.log('\nTesting WITHOUT responseMimeType ...')
try {
  const r2 = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 1024, temperature: 0.2 },
  })
  console.log('RAW RESPONSE (without mimeType):\n', r2.text.slice(0, 500))
  JSON.parse(r2.text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, ''))
  console.log('✅ Valid JSON without responseMimeType')
} catch(e) {
  console.log('❌ Failed without responseMimeType:', e.message)
}
