export type Role = 'civil' | 'undercover' | 'mrwhite'
export type Status = 'lobby' | 'reveal' | 'debate' | 'vote' | 'result' | 'mrwhite' | 'finished'
export type Winner = 'civils' | 'impostors' | 'mrwhite'

export interface Settings {
  undercovers: number
  mr_white: boolean
  debate_seconds: number
  lang: string
  category: string | null
}

export interface Room {
  id: string
  code: string
  host_id: string
  game: string
  status: Status
  settings: Settings
  round: number
  phase_ends_at: string | null
  starter_id: string | null
  last_eliminated_id: string | null
  winner: Winner | null
}

export interface Player {
  id: string
  room_id: string
  user_id: string | null
  name: string
  is_local: boolean
  seat: number
  alive: boolean
  ready: boolean
  has_voted: boolean
  revealed_role: Role | null
}

export interface Secret { role: Role; word: string | null }
export interface Reveal { civil_word: string; undercover_word: string }
export interface Profile { id: string; pseudo: string; games_played: number; games_won: number }
