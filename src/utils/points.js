/* ─────────────────────────────────────────────
   NGL Paper — Points & Missions System
   Stored entirely in localStorage.
   ───────────────────────────────────────────── */

const STORAGE_KEY = 'ngl-missions'

export const MISSIONS = [
  {
    id: 'wallet_connect',
    title: 'First Connection',
    description: 'Connect your wallet to NGL Paper',
    icon: '🔗',
    points: 100,
    color: 'green',
    repeatable: false,
  },
  {
    id: 'ask_dr_paper',
    title: 'Ask Dr. Paper',
    description: 'Send your first message to Dr. Paper AI',
    icon: '💬',
    points: 100,
    color: 'purple',
    repeatable: false,
  },
  {
    id: 'use_paper',
    title: 'Explain a Paper',
    description: 'Use the Whitepaper Explainer feature',
    icon: '📄',
    points: 50,         // per-use reward (after first)
    pointsFirst: 200,  // first-use bonus
    color: 'gold',
    repeatable: true,  // earns points every time
  },
]

/* ── Read state ─────────────────────────────── */
export function getMissionState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // counts: { [missionId]: number } tracks repeatable mission uses
    return raw ? JSON.parse(raw) : { completed: [], counts: {}, totalPoints: 0 }
  } catch {
    return { completed: [], counts: {}, totalPoints: 0 }
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

/* ── Complete a one-shot mission ────────────── */
// Returns { awarded, points } — awarded=false if already done
export function completeMission(missionId) {
  const state = getMissionState()
  if (!state.counts) state.counts = {}
  if (state.completed.includes(missionId)) return { awarded: false, points: 0 }

  const mission = MISSIONS.find(m => m.id === missionId)
  if (!mission || mission.repeatable) return { awarded: false, points: 0 }

  state.completed.push(missionId)
  state.totalPoints = (state.totalPoints || 0) + mission.points
  saveState(state)

  return { awarded: true, points: mission.points }
}

/* ── Complete a repeatable mission ──────────── */
// First call gives pointsFirst (200), every subsequent call gives points (50)
export function completeRepeatableMission(missionId) {
  const state = getMissionState()
  if (!state.counts) state.counts = {}

  const mission = MISSIONS.find(m => m.id === missionId)
  if (!mission || !mission.repeatable) return { awarded: false, points: 0, count: 0 }

  const prevCount = state.counts[missionId] || 0
  const newCount  = prevCount + 1
  const pts       = prevCount === 0 ? (mission.pointsFirst ?? mission.points) : mission.points

  state.counts[missionId] = newCount
  state.totalPoints = (state.totalPoints || 0) + pts

  // Light up the mission card on first use
  if (!state.completed.includes(missionId)) state.completed.push(missionId)

  saveState(state)
  return { awarded: true, points: pts, count: newCount }
}

/* ── Get use count for a repeatable mission ─── */
export function getMissionCount(missionId) {
  const state = getMissionState()
  return (state.counts || {})[missionId] || 0
}

/* ── Check if a mission is done ─────────────── */
export function isMissionComplete(missionId) {
  return getMissionState().completed.includes(missionId)
}

/* ── Total points ───────────────────────────── */
export function getTotalPoints() {
  return getMissionState().totalPoints || 0
}
