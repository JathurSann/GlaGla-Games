import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Player, Room } from './types'

export interface RoomState {
  loading: boolean
  room: Room | null
  players: Player[]
  refresh: () => Promise<void>
}

// Charge le salon + joueurs et reste synchronisé (Realtime + sondage de secours).
export function useRoom(code: string | undefined, enabled: boolean): RoomState {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const roomId = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!code) return
    const { data: r } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle()
    if (!r) { setRoom(null); setPlayers([]); roomId.current = null; setLoading(false); return }
    roomId.current = r.id
    const { data: p } = await supabase.from('room_players').select('*').eq('room_id', r.id).order('seat')
    setRoom(r as Room)
    setPlayers((p ?? []) as Player[])
    setLoading(false)
  }, [code])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const poll = setInterval(() => { if (!document.hidden) void refresh() }, 4000)
    const onVis = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', onVis) }
  }, [enabled, refresh])

  useEffect(() => {
    if (!room?.id) return
    const ch = supabase.channel(`room:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [room?.id, refresh])

  return { loading, room, players, refresh }
}
