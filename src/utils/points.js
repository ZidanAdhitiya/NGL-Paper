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
  },
  {
    id: 'ask_dr_paper',
    title: 'Ask Dr. Paper',
    description: 'Send your first message to Dr. Paper AI',
    icon: '💬',
    points: 100,
    color: 'purple',
  },
]

/* ── Read state ─────────────────────────────── */
export function getMissionState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { completed: [], totalPoints: 0 }
  } catch {
    return { completed: [], totalPoints: 0 }
  }
}

/* ── Complete a mission ─────────────────────── */
// Returns { awarded, points } — awarded=false if already done
export function completeMission(missionId) {
  const state = getMissionState()
  if (state.completed.includes(missionId)) return { awarded: false, points: 0 }

  const mission = MISSIONS.find(m => m.id === missionId)
  if (!mission) return { awarded: false, points: 0 }

  state.completed.push(missionId)
  state.totalPoints = (state.totalPoints || 0) + mission.points
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}

  return { awarded: true, points: mission.points }
}

/* ── Check if a mission is done ─────────────── */
export function isMissionComplete(missionId) {
  return getMissionState().completed.includes(missionId)
}

/* ── Total points ───────────────────────────── */
export function getTotalPoints() {
  return getMissionState().totalPoints || 0
}
