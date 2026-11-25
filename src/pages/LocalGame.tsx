import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Page, Toggle, roleEmoji, roleLabel } from '../components/ui'
import { LOGO } from '../lib/supabase'
import {
  initialState, loadPairs, maxImpostorsOk, norm, startGame, winnerOf,
  type LPlayer, type LState, type Pair,
} from '../lib/localGame'
import { fmtTime } from '../components/room/shared'

const LS = 'glagla:local:v1'
const DURATIONS = [60, 120, 180, 240, 300, 420, 600]

function load(): LState {
  try {
    const raw = localStorage.getItem(LS)
    if (raw) return JSON.parse(raw) as LState
  } catch { /* ignore */ }
  return initialState(['', '', ''])
}

export default function LocalGame() {
  const nav = useNavigate()
  const [st, setSt] = useState<LState>(load)
  const [pairs, setPairs] = useState<Pair[]>([])
  const patch = (p: Partial<LState>) => setSt((s) => ({ ...s, ...p }))

  useEffect(() => { void loadPairs().then(setPairs) }, [])
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(st)) } catch { /* ignore */ } }, [st])

  const quit = () => { setSt(initialState(st.names, st.settings)); nav('/') }
  const inGame = st.phase !== 'setup'

  return (
    <Page title="Un seul téléphone" back={inGame ? false : '/undercover'}>
      {st.phase === 'setup' && <Setup st={st} patch={patch} pairs={pairs} onStart={(names) => setSt(startGame(names, st.settings, pairs))} />}
      {st.phase === 'reveal' && <Reveal st={st} patch={patch} />}
      {st.phase === 'debate' && <Debate st={st} patch={patch} />}
      {st.phase === 'vote' && <Vote st={st} patch={patch} />}
      {st.phase === 'result' && <Result st={st} patch={patch} />}
      {st.phase === 'mrwhite' && <MrWhite st={st} patch={patch} />}
      {st.phase === 'finished' && <Finished st={st} setSt={setSt} pairs={pairs} onQuit={quit} />}
      {inGame && st.phase !== 'finished' && (
        <button className="link" style={{ alignSelf: 'center' }} onClick={() => { if (confirm('Abandonner la partie ?')) quit() }}>Abandonner la partie</button>
      )}
    </Page>
  )
}

type P = { st: LState; patch: (p: Partial<LState>) => void }

/* ---------- Préparation ---------- */
function Setup({ st, patch, pairs, onStart }: P & { pairs: Pair[]; onStart: (names: string[]) => void }) {
  const names = st.names
  const filled = names.map((n) => n.trim()).filter(Boolean)
  const s = st.settings
  const cats = useMemo(() => [...new Set(pairs.map((p) => p.category))].sort(), [pairs])
  const dup = new Set(filled.map((n) => n.toLowerCase())).size !== filled.length
  const valid = maxImpostorsOk(filled.length, s) && !dup && pairs.length > 0
  const setS = (p: Partial<typeof s>) => patch({ settings: { ...s, ...p } })

  return (
    <>
      <section className="hero">
        <h2>Tous sur<br />le même tél.</h2>
        <p>Passez-vous le téléphone : chacun découvre sa carte en secret.</p>
        <img src={LOGO} alt="" />
      </section>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title">Joueurs ({filled.length})</h2>
        {filled.length < 3 && <span className="chip">Min. 3</span>}
      </div>
      <div className="list">
        {names.map((n, i) => (
          <div key={i} className="player">
            <Avatar name={n || '?'} seat={i} />
            <input className="input grow" style={{ minHeight: 40, background: 'transparent', padding: 0 }} placeholder={`Joueur ${i + 1}`} maxLength={20}
              value={n} onChange={(e) => patch({ names: names.map((x, j) => (j === i ? e.target.value : x)) })} />
            {names.length > 3 && <button className="x-btn" aria-label="Retirer" onClick={() => patch({ names: names.filter((_, j) => j !== i) })}>✕</button>}
          </div>
        ))}
      </div>
      {names.length < 20 && <button className="btn btn-ghost" onClick={() => patch({ names: [...names, ''] })}>+ Ajouter un joueur</button>}
      {dup && <p className="banner">Deux joueurs ont le même prénom.</p>}

      <div className="card">
        <h2>Réglages</h2>
        <div className="setting"><div><p className="t">Undercovers</p><p className="d">Infiltrés avec un mot proche</p></div>
          <div className="stepper">
            <button disabled={s.undercovers <= 1} onClick={() => setS({ undercovers: s.undercovers - 1 })}>−</button><b>{s.undercovers}</b>
            <button disabled={s.undercovers >= 5} onClick={() => setS({ undercovers: s.undercovers + 1 })}>+</button>
          </div></div>
        <div className="setting"><div><p className="t">Mr. White</p><p className="d">Un joueur sans aucun mot</p></div>
          <Toggle on={s.mrWhite} onChange={(v) => setS({ mrWhite: v })} /></div>
        <div className="setting"><div><p className="t">Durée du débat</p></div>
          <select className="input" style={{ width: 110, minHeight: 40 }} value={s.debateSeconds} onChange={(e) => setS({ debateSeconds: Number(e.target.value) })}>
            {DURATIONS.map((d) => <option key={d} value={d}>{fmtTime(d)}</option>)}</select></div>
        <div className="setting"><div><p className="t">Thème des mots</p></div>
          <select className="input" style={{ width: 150, minHeight: 40 }} value={s.category ?? ''} onChange={(e) => setS({ category: e.target.value || null })}>
            <option value="">Tous</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      {!maxImpostorsOk(filled.length, s) && filled.length >= 3 && <p className="banner">Trop d'infiltrés : il doit rester plus de civils que d'infiltrés.</p>}
      <button className="btn btn-primary" disabled={!valid} onClick={() => onStart(filled)}>Distribuer les cartes</button>
    </>
  )
}

/* ---------- Distribution des cartes ---------- */
function Reveal({ st, patch }: P) {
  const p = st.players[st.revealIdx]
  const [stage, setStage] = useState<'handoff' | 'card'>('handoff')
  const [shown, setShown] = useState(false)
  const [seen, setSeen] = useState(false)
  const last = st.revealIdx === st.players.length - 1
  const starter = st.players[st.starter]

  const next = () => {
    setStage('handoff'); setShown(false); setSeen(false)
    if (last) patch({ phase: 'debate', endsAt: Date.now() + st.settings.debateSeconds * 1000 })
    else patch({ revealIdx: st.revealIdx + 1 })
  }

  return (
    <>
      <p className="muted" style={{ textAlign: 'center' }}>Carte {st.revealIdx + 1} sur {st.players.length}</p>
      {stage === 'handoff' ? (
        <>
          <div className="big-result">
            <Avatar name={p.name} seat={p.id} />
            <h2>Passe le téléphone à {p.name}</h2>
            <p className="muted">Les autres, ne regardez pas l'écran 🙈</p>
          </div>
          <button className="btn btn-primary" onClick={() => setStage('card')}>Je suis {p.name}</button>
        </>
      ) : (
        <>
          <button className={`secret ${shown ? 'shown' : ''} ${shown ? 'r-' + p.role : ''}`} onClick={() => { setShown(!shown); setSeen(true) }}>
            {!shown ? (
              <div><img src={LOGO} alt="" /><p className="hint">Carte de {p.name}</p><p className="sub">Touche pour voir</p></div>
            ) : (
              <div>
                <p className="role">{roleEmoji[p.role]} {roleLabel[p.role]}</p>
                {p.word ? <p className="word">{p.word}</p>
                  : <p className="word" style={{ fontSize: 26 }}>Tu n'as pas de mot !<br /><span className="muted" style={{ fontSize: 16, fontWeight: 600 }}>Écoute les autres et bluffe.</span></p>}
                <p className="sub">Touche pour cacher</p>
              </div>
            )}
          </button>
          <button className="btn btn-primary" disabled={!seen || shown} onClick={next}>
            {last ? `C'est noté · ${starter.name} commence` : "J'ai mémorisé, au suivant"}
          </button>
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>{!seen ? 'Regarde ta carte puis cache-la.' : shown ? 'Cache la carte avant de passer le téléphone.' : ''}</p>
        </>
      )}
    </>
  )
}

/* ---------- Débat ---------- */
function Debate({ st, patch }: P) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i) }, [])
  const total = st.settings.debateSeconds
  const left = Math.max(0, Math.ceil(((st.endsAt ?? now) - now) / 1000))
  const alive = st.players.filter((p) => p.alive)
  const dead = st.players.filter((p) => !p.alive)
  const starter = st.players[st.starter]
  useEffect(() => { if (left === 0) { navigator.vibrate?.(300); patch({ phase: 'vote', endsAt: null }) } }, [left]) // eslint-disable-line react-hooks/exhaustive-deps
  const R = 98, C = 2 * Math.PI * R

  return (
    <>
      <div className={`timer ${left <= 15 ? 'low' : ''}`}>
        <svg viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={R} fill="none" stroke="#2a2a2a" strokeWidth="10" />
          <circle cx="110" cy="110" r={R} fill="none" stroke={left <= 15 ? 'var(--red)' : 'var(--yellow)'} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, left / total))} style={{ transition: 'stroke-dashoffset .3s linear' }} />
        </svg>
        <div><div className="t">{fmtTime(left)}</div><div className="l">Débat · Tour {st.round}</div></div>
      </div>
      {starter?.alive && st.round === 1 && <p className="banner accent">🎤 <b>{starter.name}</b> lance la discussion</p>}
      <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>Discutez librement, posez des questions, accusez… mais ne dites jamais votre mot !</p>
      <Roster players={alive} />
      {dead.length > 0 && <><h3 className="muted">Éliminés</h3><Roster players={dead} /></>}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => patch({ endsAt: (st.endsAt ?? Date.now()) + 60000 })}>+1 min</button>
        <button className="btn btn-primary" onClick={() => patch({ phase: 'vote', endsAt: null })}>Passer au vote</button>
      </div>
    </>
  )
}

const Roster = ({ players }: { players: LPlayer[] }) => (
  <div className="list">
    {players.map((p) => (
      <div key={p.id} className={`player ${p.alive ? '' : 'dead'}`}>
        <Avatar name={p.name} seat={p.id} /><span className="pname">{p.name}</span>
        {!p.alive && <span className={`tag ${p.role}`}>{roleLabel[p.role]}</span>}
      </div>
    ))}
  </div>
)

/* ---------- Vote (en groupe) ---------- */
function Vote({ st, patch }: P) {
  const [sel, setSel] = useState<number | null>(null)
  const alive = st.players.filter((p) => p.alive)

  const confirm = (id: number | null) => {
    if (id === null) return patch({ phase: 'result', elimId: null })
    const players = st.players.map((p) => (p.id === id ? { ...p, alive: false } : p))
    const out = players[id]
    if (out.role === 'mrwhite') return patch({ players, elimId: id, phase: 'mrwhite' })
    const w = winnerOf(players)
    patch({ players, elimId: id, ...(w ? { phase: 'finished', winner: w } : { phase: 'result' }) })
  }

  return (
    <>
      <h2 className="section-title">Qui est éliminé ?</h2>
      <p className="muted">Votez à main levée (ou comptez les doigts pointés), puis touchez le joueur le plus accusé.</p>
      <div className="list">
        {alive.map((p) => (
          <button key={p.id} className={`player selectable ${sel === p.id ? 'selected' : ''}`} onClick={() => setSel(p.id)}>
            <Avatar name={p.name} seat={p.id} /><span className="pname">{p.name}</span>{sel === p.id && <span>🗳️</span>}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" disabled={sel === null} onClick={() => confirm(sel)}>Éliminer {sel !== null ? st.players[sel].name : ''}</button>
      <button className="btn btn-ghost" onClick={() => confirm(null)}>Égalité : personne n'est éliminé</button>
    </>
  )
}

/* ---------- Résultat du tour ---------- */
function Result({ st, patch }: P) {
  const out = st.elimId !== null ? st.players[st.elimId] : null
  const alive = st.players.filter((p) => p.alive)
  const next = () => {
    const cands = alive.filter((p) => p.role !== 'mrwhite')
    const starter = (cands.length ? cands : alive)[Math.floor(Math.random() * (cands.length || alive.length))].id
    patch({ phase: 'debate', round: st.round + 1, starter, elimId: null, endsAt: Date.now() + st.settings.debateSeconds * 1000 })
  }
  return (
    <>
      {out ? (
        <div className="big-result"><div className="emoji">{roleEmoji[out.role]}</div><p className="muted">Éliminé</p><h2>{out.name}</h2>
          <span className={`tag ${out.role}`}>Il était {roleLabel[out.role]}</span></div>
      ) : (
        <div className="big-result"><div className="emoji">⚖️</div><h2>Égalité !</h2><p className="muted">Personne n'est éliminé. Le débat reprend.</p></div>
      )}
      <h3 className="muted">Toujours en jeu ({alive.length})</h3>
      <Roster players={alive} />
      <button className="btn btn-primary" onClick={next}>Tour suivant</button>
    </>
  )
}

/* ---------- Mr. White ---------- */
function MrWhite({ st, patch }: P) {
  const [guess, setGuess] = useState('')
  const [handed, setHanded] = useState(false)
  const out = st.players[st.elimId!]
  const submit = () => {
    if (norm(guess) && norm(guess) === norm(st.civilWord)) return patch({ phase: 'finished', winner: 'mrwhite' })
    const w = winnerOf(st.players)
    patch(w ? { phase: 'finished', winner: w } : { phase: 'result' })
  }
  return (
    <>
      <div className="big-result"><div className="emoji">⚪</div><p className="muted">Éliminé</p><h2>{out.name}</h2><span className="tag mrwhite">C'était Mr. White</span></div>
      {!handed ? (
        <button className="btn btn-primary" onClick={() => setHanded(true)}>Passer le téléphone à {out.name}</button>
      ) : (
        <div className="card">
          <h2>Dernière chance, {out.name} !</h2>
          <p className="muted">Devine le mot des civils : si tu trouves, tu gagnes seul.</p>
          <input className="input" autoFocus placeholder="Le mot des civils…" value={guess} onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guess.trim() && submit()} />
          <button className="btn btn-primary" disabled={!guess.trim()} onClick={submit}>Valider</button>
        </div>
      )}
    </>
  )
}

/* ---------- Fin ---------- */
function Finished({ st, setSt, pairs, onQuit }: { st: LState; setSt: (s: LState) => void; pairs: Pair[]; onQuit: () => void }) {
  const title = { civils: 'Les civils gagnent !', impostors: 'Les infiltrés gagnent !', mrwhite: 'Mr. White gagne !' }[st.winner ?? 'civils']
  const emoji = st.winner === 'civils' ? '🎉' : st.winner === 'mrwhite' ? '⚪' : '🕵️'
  return (
    <>
      <div className="big-result"><div className="emoji">{emoji}</div><h2>{title}</h2></div>
      <div className="row">
        <div className="card grow" style={{ textAlign: 'center' }}><p className="muted" style={{ fontSize: 12 }}>CIVILS</p><b style={{ fontSize: 22, color: 'var(--green)' }}>{st.civilWord}</b></div>
        <div className="card grow" style={{ textAlign: 'center' }}><p className="muted" style={{ fontSize: 12 }}>UNDERCOVER</p><b style={{ fontSize: 22, color: 'var(--orange)' }}>{st.undercoverWord}</b></div>
      </div>
      <div className="list">
        {st.players.map((p) => (
          <div key={p.id} className="player"><Avatar name={p.name} seat={p.id} /><span className="pname">{p.name}</span><span className={`tag ${p.role}`}>{roleLabel[p.role]}</span></div>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => setSt(startGame(st.names, st.settings, pairs))}>Rejouer (nouveaux mots et rôles)</button>
      <button className="btn btn-ghost" onClick={() => setSt(initialState(st.names, st.settings))}>Modifier les joueurs / réglages</button>
      <button className="link" style={{ alignSelf: 'center' }} onClick={onQuit}>Quitter</button>
    </>
  )
}

