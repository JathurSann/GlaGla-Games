import { supabase, isConfigured } from './supabase'
import { BUNDLED_PAIRS } from '../data/wordPairs'
import type { Role, Winner } from './types'

export interface LPlayer { id: number; name: string; role: Role; word: string | null; alive: boolean }
export type LPhase = 'setup' | 'reveal' | 'debate' | 'vote' | 'result' | 'mrwhite' | 'finished'
export interface LSettings { undercovers: number; mrWhite: boolean; debateSeconds: number; category: string | null }
export interface LState {
  phase: LPhase
  names: string[]
  settings: LSettings
  players: LPlayer[]
  civilWord: string
  undercoverWord: string
  round: number
  revealIdx: number
  endsAt: number | null
  starter: number
  elimId: number | null
  winner: Winner | null
}

export const DEFAULT_SETTINGS: LSettings = { undercovers: 1, mrWhite: false, debateSeconds: 180, category: null }
export const initialState = (names: string[] = [], settings = DEFAULT_SETTINGS): LState => ({
  phase: 'setup', names, settings, players: [], civilWord: '', undercoverWord: '', round: 0, revealIdx: 0,
  endsAt: null, starter: 0, elimId: null, winner: null,
})

export interface Pair { civil: string; undercover: string; category: string }
const bundled: Pair[] = BUNDLED_PAIRS.map(([civil, undercover, category]) => ({ civil, undercover, category }))

// Mots depuis Supabase si possible (rapide, 3 s max), sinon liste intégrée.
export async function loadPairs(): Promise<Pair[]> {
  if (!isConfigured) return bundled
  try {
    const q = supabase.from('word_pairs').select('civil_word, undercover_word, category').eq('approved', true).eq('lang', 'fr')
    const res = await Promise.race([q, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))])
    const rows = (res as { data: { civil_word: string; undercover_word: string; category: string }[] | null }).data
    if (rows && rows.length) return rows.map((r) => ({ civil: r.civil_word, undercover: r.undercover_word, category: r.category }))
  } catch { /* hors-ligne : on garde la liste intégrée */ }
  return bundled
}

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

export const maxImpostorsOk = (n: number, s: LSettings) => {
  const imp = s.undercovers + (s.mrWhite ? 1 : 0)
  return n >= 3 && n - imp > imp
}

export function startGame(names: string[], settings: LSettings, pairs: Pair[]): LState {
  const pool = pairs.filter((p) => !settings.category || p.category === settings.category)
  const pair = shuffle(pool.length ? pool : pairs)[0]
  const swap = Math.random() < 0.5
  const civilWord = swap ? pair.undercover : pair.civil
  const undercoverWord = swap ? pair.civil : pair.undercover
  const roles: Role[] = shuffle<Role>([
    ...Array(settings.undercovers).fill('undercover'),
    ...(settings.mrWhite ? ['mrwhite' as Role] : []),
    ...Array(names.length - settings.undercovers - (settings.mrWhite ? 1 : 0)).fill('civil'),
  ])
  const players: LPlayer[] = names.map((name, id) => ({
    id, name, alive: true, role: roles[id],
    word: roles[id] === 'civil' ? civilWord : roles[id] === 'undercover' ? undercoverWord : null,
  }))
  const starters = players.filter((p) => p.role !== 'mrwhite')
  return { ...initialState(names, settings), phase: 'reveal', players, civilWord, undercoverWord, round: 1,
    starter: shuffle(starters)[0].id }
}

export function winnerOf(players: LPlayer[]): Winner | null {
  const alive = players.filter((p) => p.alive)
  const civils = alive.filter((p) => p.role === 'civil').length
  const impostors = alive.length - civils
  if (impostors === 0) return 'civils'
  if (impostors >= civils) return 'impostors'
  return null
}

export const norm = (t: string) =>
  t.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]/g, '')
