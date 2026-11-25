import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Player, Reveal } from '../../lib/types'
import { Avatar, roleEmoji, roleLabel, useToast } from '../ui'
import SecretCard from './SecretCard'
import type { RoomCtx } from './shared'
import { fmtTime } from './shared'

function Sheet({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

const Roster = ({ players, extra }: { players: Player[]; extra?: (p: Player) => React.ReactNode }) => (
  <div className="list">
    {players.map((p) => (
      <div key={p.id} className={`player ${p.alive ? '' : 'dead'}`}>
        <Avatar name={p.name} seat={p.seat} />
        <span className="pname">{p.name}</span>
        {!p.alive && p.revealed_role && <span className={`tag ${p.revealed_role}`}>{roleLabel[p.revealed_role]}</span>}
        {extra?.(p)}
      </div>
    ))}
  </div>
)

/* ===================== RÉVÉLATION DES CARTES ===================== */
export function RevealPhase({ room, players, me, isHost, act, busy, refresh }: RoomCtx) {
  const [passing, setPassing] = useState<Player | null>(null)
  const locals = players.filter((p) => p.is_local)
  const readyCount = players.filter((p) => p.ready).length
  const allReady = readyCount === players.length
  const starter = players.find((p) => p.id === room.starter_id)

  return (
    <>
      <h2 className="section-title">Découvre ta carte</h2>
      {me && !me.ready && <SecretCard playerId={me.id} markReady onDone={() => void refresh()} />}
      {me?.ready && <p className="banner accent">✅ Carte mémorisée. En attente des autres…</p>}

      {isHost && locals.some((p) => !p.ready) && (
        <div className="card">
          <h2>📱 Passer le téléphone</h2>
          <p className="muted" style={{ fontSize: 13 }}>Choisis un joueur, donne-lui ton téléphone, puis récupère-le quand il a caché sa carte.</p>
          <div className="list">
            {locals.filter((p) => !p.ready).map((p) => (
              <button key={p.id} className="player selectable" onClick={() => setPassing(p)}>
                <Avatar name={p.name} seat={p.seat} /><span className="pname">{p.name}</span><span className="tag">Voir sa carte</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title">Prêts</h2><span className="chip">{readyCount}/{players.length}</span>
      </div>
      <Roster players={players} extra={(p) => <span className={`tag ${p.ready ? 'ok' : ''}`}>{p.ready ? 'Prêt' : '…'}</span>} />

      {isHost
        ? <button className="btn btn-primary" disabled={!allReady || busy} onClick={() => act(() => api.beginDebate(room.id))}>Lancer le débat{starter ? ` · ${starter.name} commence` : ''}</button>
        : <p className="muted" style={{ textAlign: 'center' }}>L'hôte lancera le débat quand tout le monde est prêt.</p>}

      {passing && (
        <Sheet>
          <h2 className="section-title">{passing.name}, c'est à toi</h2>
          <SecretCard playerId={passing.id} name={passing.name} markReady onDone={() => { setPassing(null); void refresh() }} />
        </Sheet>
      )}
    </>
  )
}

/* ===================== DÉBAT ===================== */
export function DebatePhase({ room, players, me, isHost, act, busy }: RoomCtx) {
  const [peek, setPeek] = useState(false)
  const [now, setNow] = useState(Date.now())
  const total = room.settings.debate_seconds
  const ends = room.phase_ends_at ? new Date(room.phase_ends_at).getTime() : now
  const left = Math.max(0, Math.ceil((ends - now) / 1000))
  const starter = players.find((p) => p.id === room.starter_id)
  const alive = players.filter((p) => p.alive)
  const fired = useRef(0)

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i) }, [])
  // Chrono écoulé : n'importe quel joueur peut passer au vote (au cas où l'hôte aurait lâché son téléphone)
  useEffect(() => {
    if (left > 0 || Date.now() - fired.current < 3000) return
    fired.current = Date.now()
    api.startVote(room.id).catch(() => { /* too_early / déjà fait */ })
  }, [left, room.id])

  const R = 98, C = 2 * Math.PI * R
  const ratio = Math.min(1, left / total)

  return (
    <>
      <div className={`timer ${left <= 15 ? 'low' : ''}`}>
        <svg viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={R} fill="none" stroke="#2a2a2a" strokeWidth="10" />
          <circle cx="110" cy="110" r={R} fill="none" stroke={left <= 15 ? 'var(--red)' : 'var(--yellow)'} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
        </svg>
        <div><div className="t">{fmtTime(left)}</div><div className="l">Débat · Tour {room.round}</div></div>
      </div>

      {starter && <p className="banner accent">🎤 <b>{starter.name}</b> lance la discussion</p>}
      <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>Discutez librement, posez des questions, accusez… mais ne dites jamais votre mot !</p>

      <Roster players={alive} />
      {players.some((p) => !p.alive) && <><h3 className="muted">Éliminés</h3><Roster players={players.filter((p) => !p.alive)} /></>}

      {me?.alive && <button className="btn btn-ghost" onClick={() => setPeek(true)}>👁 Revoir ma carte</button>}
      {isHost && (
        <div className="row">
          <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.extendDebate(room.id, 60))}>+1 min</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.startVote(room.id))}>Passer au vote</button>
        </div>
      )}
      {peek && me && <Sheet onClose={() => setPeek(false)}><SecretCard playerId={me.id} onDone={() => setPeek(false)} /></Sheet>}
    </>
  )
}

/* ===================== VOTE ===================== */
function Ballot({ voter, players, onVote }: { voter: Player; players: Player[]; onVote: (target: string) => Promise<void> }) {
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const targets = players.filter((p) => p.alive && p.id !== voter.id)
  return (
    <>
      <div className="list">
        {targets.map((p) => (
          <button key={p.id} className={`player selectable ${sel === p.id ? 'selected' : ''}`} onClick={() => setSel(p.id)}>
            <Avatar name={p.name} seat={p.seat} /><span className="pname">{p.name}</span>{sel === p.id && <span>🗳️</span>}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" disabled={!sel || busy} onClick={async () => { setBusy(true); try { await onVote(sel!) } finally { setBusy(false) } }}>
        Valider mon vote
      </button>
    </>
  )
}

export function VotePhase({ room, players, me, isHost, act, busy }: RoomCtx) {
  const [proxy, setProxy] = useState<Player | null>(null)
  const alive = players.filter((p) => p.alive)
  const votedCount = alive.filter((p) => p.has_voted).length
  const pendingLocals = alive.filter((p) => p.is_local && !p.has_voted)

  return (
    <>
      <h2 className="section-title">Qui est l'infiltré ?</h2>
      {me?.alive && !me.has_voted && (
        <Ballot voter={me} players={players} onVote={(t) => act(() => api.castVote(me.id, t))} />
      )}
      {me?.alive && me.has_voted && <p className="banner accent">🗳️ Vote enregistré. On attend les autres…</p>}
      {me && !me.alive && <p className="banner">Tu es éliminé : regarde la suite en spectateur 👻</p>}

      {isHost && pendingLocals.length > 0 && (
        <div className="card">
          <h2>📱 Votes sans téléphone</h2>
          <p className="muted" style={{ fontSize: 13 }}>Passe ton téléphone à chaque joueur pour qu'il vote en secret.</p>
          <div className="list">
            {pendingLocals.map((p) => (
              <button key={p.id} className="player selectable" onClick={() => setProxy(p)}>
                <Avatar name={p.name} seat={p.seat} /><span className="pname">{p.name}</span><span className="tag">Voter</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Votes</h3><span className="chip">{votedCount}/{alive.length}</span>
      </div>
      <Roster players={alive} extra={(p) => <span className={`tag ${p.has_voted ? 'ok' : ''}`}>{p.has_voted ? 'A voté' : '…'}</span>} />

      {isHost && <button className="btn btn-ghost" disabled={busy || votedCount === 0} onClick={() => act(() => api.forceResolve(room.id))}>Clôturer le vote maintenant</button>}

      {proxy && (
        <Sheet>
          <h2 className="section-title">{proxy.name}, vote en secret</h2>
          <Ballot voter={proxy} players={players} onVote={async (t) => { await act(() => api.castVote(proxy.id, t)); setProxy(null) }} />
        </Sheet>
      )}
    </>
  )
}

/* ===================== RÉSULTAT DU TOUR ===================== */
export function ResultPhase({ room, players, isHost, act, busy }: RoomCtx) {
  const out = players.find((p) => p.id === room.last_eliminated_id)
  const alive = players.filter((p) => p.alive)
  return (
    <>
      {out ? (
        <div className="big-result">
          <div className="emoji">{out.revealed_role ? roleEmoji[out.revealed_role] : '💀'}</div>
          <p className="muted">Éliminé</p>
          <h2>{out.name}</h2>
          {out.revealed_role && <span className={`tag ${out.revealed_role}`}>Il était {roleLabel[out.revealed_role]}</span>}
        </div>
      ) : (
        <div className="big-result"><div className="emoji">⚖️</div><h2>Égalité !</h2><p className="muted">Personne n'est éliminé. Le débat reprend.</p></div>
      )}
      <h3 className="muted">Toujours en jeu ({alive.length})</h3>
      <Roster players={alive} />
      {isHost
        ? <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.nextRound(room.id))}>Tour suivant</button>
        : <p className="muted" style={{ textAlign: 'center' }}>L'hôte lance le tour suivant…</p>}
    </>
  )
}

/* ===================== MR. WHITE ===================== */
export function MrWhitePhase({ room, players, userId, isHost, act, busy }: RoomCtx) {
  const { toast } = useToast()
  const [guess, setGuess] = useState('')
  const out = players.find((p) => p.id === room.last_eliminated_id)
  const can = Boolean(out && (out.user_id === userId || (out.is_local && isHost)))
  const submit = async () => {
    await act(async () => {
      const ok = await api.mrWhiteGuess(room.id, guess)
      toast(ok ? 'Bien vu, Mr. White ! 🎉' : 'Raté… 😬', ok ? 'ok' : 'err')
    })
  }
  return (
    <>
      <div className="big-result"><div className="emoji">⚪</div><p className="muted">Éliminé</p><h2>{out?.name}</h2><span className="tag mrwhite">C'était Mr. White</span></div>
      {can ? (
        <div className="card">
          <h2>Dernière chance !</h2>
          <p className="muted">Devine le mot des civils : si tu trouves, tu gagnes seul.</p>
          <input className="input" autoFocus placeholder="Le mot des civils…" value={guess} onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guess.trim() && submit()} />
          <button className="btn btn-primary" disabled={!guess.trim() || busy} onClick={submit}>Valider</button>
        </div>
      ) : <p className="banner accent">{out?.name} tente de deviner le mot des civils…</p>}
    </>
  )
}

/* ===================== FIN DE PARTIE ===================== */
export function FinishedPhase({ room, players, isHost, act, busy }: RoomCtx) {
  const [words, setWords] = useState<Reveal | null>(null)
  const { fail } = useToast()
  useEffect(() => { api.getReveal(room.id).then(setWords).catch(fail) }, [room.id, fail])
  const title = useMemo(() => ({ civils: 'Les civils gagnent !', impostors: 'Les infiltrés gagnent !', mrwhite: 'Mr. White gagne !' }[room.winner ?? 'civils']), [room.winner])
  const emoji = room.winner === 'civils' ? '🎉' : room.winner === 'mrwhite' ? '⚪' : '🕵️'
  return (
    <>
      <div className="big-result"><div className="emoji">{emoji}</div><h2>{title}</h2></div>
      {words && (
        <div className="row">
          <div className="card grow" style={{ textAlign: 'center' }}><p className="muted" style={{ fontSize: 12 }}>CIVILS</p><b style={{ fontSize: 22, color: 'var(--green)' }}>{words.civil_word}</b></div>
          <div className="card grow" style={{ textAlign: 'center' }}><p className="muted" style={{ fontSize: 12 }}>UNDERCOVER</p><b style={{ fontSize: 22, color: 'var(--orange)' }}>{words.undercover_word}</b></div>
        </div>
      )}
      <Roster players={players} extra={(p) => p.revealed_role && <span className={`tag ${p.revealed_role}`}>{roleLabel[p.revealed_role]}</span>} />
      {isHost
        ? <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.playAgain(room.id))}>Rejouer avec les mêmes joueurs</button>
        : <p className="muted" style={{ textAlign: 'center' }}>L'hôte peut relancer une partie.</p>}
      <button className="btn btn-ghost" onClick={() => { location.hash = '#/' }}>Quitter</button>
    </>
  )
}
