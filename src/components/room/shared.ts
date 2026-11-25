import type { Player, Room } from '../../lib/types'

export interface RoomCtx {
  room: Room
  players: Player[]
  me: Player | null
  userId: string
  isHost: boolean
  /** exécute une action serveur avec gestion d'erreur + rafraîchissement */
  act: (fn: () => Promise<unknown>) => Promise<void>
  busy: boolean
  refresh: () => Promise<void>
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
