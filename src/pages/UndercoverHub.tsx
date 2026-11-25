import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Page, useToast } from '../components/ui'

export default function UndercoverHub() {
  const nav = useNavigate()
  const { pseudo, setPseudo } = useAuth()
  const { fail, toast } = useToast()
  const [name, setName] = useState(pseudo)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim()) return toast('Choisis un prénom.', 'err')
    setBusy(true)
    try {
      await setPseudo(name)
      const r = await api.createRoom(name.trim())
      nav(`/room/${r.code}`)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const join = () => {
    const c = code.trim().toUpperCase()
    if (c.length < 4) return toast('Entre le code à 5 caractères.', 'err')
    nav(`/room/${c}`)
  }

  return (
    <Page title="Undercover" back="/">
      <section className="hero">
        <h2>Démasque<br />l'infiltré</h2>
        <p>Chacun a un mot… presque le même. Débattez, bluffez, votez.</p>
        <img src="/logo.svg" alt="" />
      </section>

      <div className="card">
        <h2>Créer un salon</h2>
        <div className="field">
          <label htmlFor="n">Ton prénom</label>
          <input id="n" className="input" value={name} maxLength={20} placeholder="Ex : Jathur" onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={create}>Créer le salon</button>
      </div>

      <div className="card">
        <h2>Rejoindre un salon</h2>
        <input className="input code" placeholder="CODE" maxLength={5} value={code} autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Code du salon" />
        <button className="btn btn-ghost" onClick={join}>Rejoindre</button>
      </div>

      <details className="card rules">
        <summary>📖 Règles du jeu</summary>
        <ul>
          <li>Chaque joueur reçoit un mot en secret sur son téléphone. Les <b>civils</b> ont tous le même mot, l'<b>undercover</b> a un mot très proche, et <b>Mr. White</b> (optionnel) n'a rien du tout.</li>
          <li>Pendant le <b>débat chronométré</b>, tout le monde discute librement : posez des questions, défendez-vous, accusez, mais sans jamais dire votre mot.</li>
          <li>Puis on vote : le joueur le plus ciblé est éliminé et son rôle est révélé. Égalité = personne ne sort.</li>
          <li>Les civils gagnent s'ils éliminent tous les infiltrés. Les infiltrés gagnent s'ils sont aussi nombreux que les civils.</li>
          <li>Si Mr. White est éliminé, il a une dernière chance : deviner le mot des civils pour gagner seul.</li>
          <li>Pas de téléphone ? L'hôte ajoute le joueur et lui passe son téléphone pour voir sa carte et voter.</li>
        </ul>
      </details>

      <button className="btn btn-ghost" onClick={() => nav('/undercover/mots')}>✍️ Proposer des mots</button>
    </Page>
  )
}
