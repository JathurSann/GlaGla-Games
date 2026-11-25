import { useEffect, useState } from 'react'
import { api, fetchCategories } from '../../lib/api'
import { Avatar, Toggle, useToast } from '../ui'
import type { RoomCtx } from './shared'
import { fmtTime } from './shared'

const DURATIONS = [60, 120, 180, 240, 300, 420, 600]

export default function Lobby({ room, players, me, isHost, act, busy }: RoomCtx) {
  const { toast } = useToast()
  const [localName, setLocalName] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const s = room.settings
  const n = players.length
  const impostors = s.undercovers + (s.mr_white ? 1 : 0)
  const valid = n >= 3 && n - impostors > impostors

  useEffect(() => { void fetchCategories().then(setCats) }, [])

  const link = `${location.origin}${location.pathname}#/join/${room.code}`
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'GlaGla Jeux', text: `Rejoins mon salon Undercover : ${room.code}`, url: link })
      else { await navigator.clipboard.writeText(link); toast('Lien copié 📋') }
    } catch { /* annulé */ }
  }
  const set = (patch: Parameters<typeof api.updateSettings>[1]) => act(() => api.updateSettings(room.id, patch))
  const addLocal = async () => {
    const v = localName.trim(); if (!v) return
    await act(() => api.addLocalPlayer(room.id, v)); setLocalName('')
  }

  return (
    <>
      <div className="codebox">
        <p className="label">Code du salon</p>
        <p className="code">{room.code}</p>
        <button className="btn btn-ghost btn-sm" onClick={share}>🔗 Inviter</button>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section-title">Joueurs ({n})</h2>
        {n < 3 && <span className="chip">Min. 3</span>}
      </div>
      <div className="list">
        {players.map((p) => (
          <div key={p.id} className="player">
            <Avatar name={p.name} seat={p.seat} />
            <span className="pname">{p.name}{p.id === me?.id ? ' (toi)' : ''}</span>
            {p.user_id === room.host_id && <span className="tag">Hôte</span>}
            {p.is_local && <span className="tag">Sur ce tél.</span>}
            {isHost && p.user_id !== room.host_id && <button className="x-btn" aria-label={`Retirer ${p.name}`} onClick={() => act(() => api.removePlayer(p.id))}>✕</button>}
            {!isHost && p.id === me?.id && <button className="x-btn" aria-label="Quitter" onClick={() => act(() => api.removePlayer(p.id)).then(() => { location.hash = '#/' })}>✕</button>}
          </div>
        ))}
      </div>

      {isHost && (
        <div className="card">
          <h2>Pas de téléphone ?</h2>
          <p className="muted" style={{ fontSize: 13 }}>Ajoute-le ici : tu lui passeras ton téléphone pour voir sa carte et voter.</p>
          <div className="row">
            <input className="input grow" placeholder="Prénom du joueur" maxLength={20} value={localName}
              onChange={(e) => setLocalName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLocal()} />
            <button className="btn btn-pink btn-sm" onClick={addLocal} disabled={!localName.trim() || busy}>Ajouter</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Réglages</h2>
        <div className="setting">
          <div><p className="t">Undercovers</p><p className="d">Infiltrés avec un mot proche</p></div>
          {isHost ? (
            <div className="stepper">
              <button disabled={s.undercovers <= 1} onClick={() => set({ undercovers: s.undercovers - 1 })} aria-label="Moins">−</button>
              <b>{s.undercovers}</b>
              <button disabled={s.undercovers >= 5} onClick={() => set({ undercovers: s.undercovers + 1 })} aria-label="Plus">+</button>
            </div>
          ) : <b>{s.undercovers}</b>}
        </div>
        <div className="setting">
          <div><p className="t">Mr. White</p><p className="d">Un joueur sans aucun mot</p></div>
          {isHost ? <Toggle on={s.mr_white} onChange={(v) => set({ mr_white: v })} /> : <b>{s.mr_white ? 'Oui' : 'Non'}</b>}
        </div>
        <div className="setting">
          <div><p className="t">Durée du débat</p><p className="d">Temps libre pour discuter</p></div>
          {isHost ? (
            <select className="input" style={{ width: 110, minHeight: 40 }} value={s.debate_seconds} onChange={(e) => set({ debate_seconds: Number(e.target.value) })}>
              {DURATIONS.map((d) => <option key={d} value={d}>{fmtTime(d)}</option>)}
            </select>
          ) : <b>{fmtTime(s.debate_seconds)}</b>}
        </div>
        <div className="setting">
          <div><p className="t">Thème des mots</p></div>
          {isHost ? (
            <select className="input" style={{ width: 150, minHeight: 40 }} value={s.category ?? ''} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">Tous</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : <b>{s.category ?? 'Tous'}</b>}
        </div>
      </div>

      {isHost ? (
        <>
          {!valid && n >= 3 && <p className="banner">Trop d'infiltrés pour {n} joueurs : il doit rester plus de civils que d'infiltrés.</p>}
          <button className="btn btn-primary" disabled={!valid || busy} onClick={() => act(() => api.startGame(room.id))}>
            {n < 3 ? 'En attente de joueurs…' : 'Lancer la partie'}
          </button>
        </>
      ) : <p className="banner">En attente de l'hôte pour lancer la partie…</p>}
    </>
  )
}
