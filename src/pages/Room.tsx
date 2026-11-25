import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useRoom } from '../lib/useRoom'
import { Page, Spinner, useToast } from '../components/ui'
import Lobby from '../components/room/Lobby'
import { DebatePhase, FinishedPhase, MrWhitePhase, RevealPhase, ResultPhase, VotePhase } from '../components/room/phases'
import type { RoomCtx } from '../components/room/shared'

function JoinPrompt({ code, onJoined }: { code: string; onJoined: () => void }) {
  const { pseudo, setPseudo } = useAuth()
  const { fail } = useToast()
  const nav = useNavigate()
  const [name, setName] = useState(pseudo)
  const [busy, setBusy] = useState(false)
  const join = async () => {
    setBusy(true)
    try { await api.joinRoom(code, name.trim()); await setPseudo(name); onJoined() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  return (
    <Page title={`Salon ${code}`} back="/">
      <div className="card">
        <h2>Rejoindre le salon</h2>
        <div className="field"><label htmlFor="jn">Ton prénom</label>
          <input id="jn" className="input" autoFocus maxLength={20} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && join()} /></div>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={join}>C'est parti</button>
        <button className="link" onClick={() => nav('/')}>Annuler</button>
      </div>
    </Page>
  )
}

export default function RoomPage() {
  const { code = '' } = useParams()
  const { userId } = useAuth()
  const { fail } = useToast()
  const nav = useNavigate()
  const { loading, room, players, refresh } = useRoom(code, true)
  const [busy, setBusy] = useState(false)

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn() } catch (e) { fail(e) } finally { setBusy(false); void refresh() }
  }, [fail, refresh])

  if (loading) return <Spinner label="Chargement du salon…" />
  const me = players.find((p) => p.user_id === userId) ?? null
  if (!room || !me) {
    // Pas encore membre (ou salon inconnu) : on tente de rejoindre
    return <JoinPrompt code={code.toUpperCase()} onJoined={() => void refresh()} />
  }
  if (!userId) return null

  const ctx: RoomCtx = { room, players, me, userId, isHost: room.host_id === userId, act, busy, refresh }
  const titles = { lobby: 'Salon', reveal: 'Cartes', debate: 'Débat', vote: 'Vote', result: 'Résultat', mrwhite: 'Mr. White', finished: 'Fin de partie' } as const

  return (
    <Page title={`${titles[room.status]} · ${room.code}`} back={room.status === 'lobby' ? '/' : false}>
      {room.status === 'lobby' && <Lobby {...ctx} />}
      {room.status === 'reveal' && <RevealPhase {...ctx} />}
      {room.status === 'debate' && <DebatePhase {...ctx} />}
      {room.status === 'vote' && <VotePhase {...ctx} />}
      {room.status === 'result' && <ResultPhase {...ctx} />}
      {room.status === 'mrwhite' && <MrWhitePhase {...ctx} />}
      {room.status === 'finished' && <FinishedPhase {...ctx} />}
      {room.status !== 'lobby' && room.status !== 'finished' && (
        <button className="link" style={{ alignSelf: 'center' }} onClick={() => nav('/')}>Quitter la partie</button>
      )}
    </Page>
  )
}
