import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page, useToast } from '../components/ui'

interface Game { key: string; icon: string; sub: string; name: string; color: string; to?: string; badge?: string }
const GAMES: Game[] = [
  { key: 'undercover', icon: '🕵️', sub: 'Mots secrets', name: 'Undercover', color: '#F5BB00', to: '/undercover', badge: 'Nouveau' },
  { key: 'loup', icon: '🐺', sub: 'Le', name: 'Loup-Garou', color: '#BF3100' },
  { key: 'prefere', icon: '🚪', sub: 'Tu', name: 'Préfères', color: '#D76A03' },
  { key: 'jamais', icon: '🤞', sub: "Je n'ai", name: 'Jamais', color: '#8EA604' },
  { key: 'av', icon: '⁉️', sub: 'Action ou', name: 'Vérité', color: '#EC9F05' },
  { key: 'cartes', icon: '🃏', sub: 'Cartes', name: 'À boire', color: '#F5BB00' },
]

export default function Home() {
  const nav = useNavigate()
  const { toast } = useToast()
  const [code, setCode] = useState('')

  const join = () => {
    const c = code.trim().toUpperCase()
    if (c.length < 4) return toast('Entre le code à 5 caractères.', 'err')
    nav(`/room/${c}`)
  }

  return (
    <Page>
      <section className="hero">
        <h2>Rejoins<br />ton salon</h2>
        <p>Entre le code affiché sur le téléphone de l'hôte.</p>
        <img src="/logo.svg" alt="" />
      </section>

      <div className="row">
        <input className="input code grow" placeholder="CODE" maxLength={5} value={code} autoCapitalize="characters" autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && join()} aria-label="Code du salon" />
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={join}>Rejoindre</button>
      </div>

      <h2 className="section-title" style={{ marginTop: 6 }}>Les jeux</h2>
      <div className="grid">
        {GAMES.map((g) => (
          <button key={g.key} className={`tile ${g.to ? '' : 'soon'}`} style={{ ['--c' as string]: g.color }}
            onClick={() => (g.to ? nav(g.to) : toast('Bientôt disponible 👀'))}>
            {g.badge && <span className="badge green">{g.badge}</span>}
            {!g.to && <span className="badge">Bientôt</span>}
            <span className="ico">{g.icon}</span>
            <span className="sub">{g.sub}</span>
            <span className="name">{g.name}</span>
          </button>
        ))}
      </div>
    </Page>
  )
}
