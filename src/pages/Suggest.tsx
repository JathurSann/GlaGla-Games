import { useEffect, useState } from 'react'
import { fetchCategories, suggestPair } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Page, useToast } from '../components/ui'
import { useNavigate } from 'react-router-dom'

export default function Suggest() {
  const { isGuest } = useAuth()
  const nav = useNavigate()
  const { toast, fail } = useToast()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [cat, setCat] = useState('general')
  const [cats, setCats] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { void fetchCategories().then(setCats) }, [])

  const send = async () => {
    if (!a.trim() || !b.trim()) return toast('Remplis les deux mots.', 'err')
    setBusy(true)
    try {
      await suggestPair(a, b, cat)
      toast('Merci ! Ta paire sera validée avant d\'apparaître 🙌')
      setA(''); setB('')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <Page title="Proposer des mots" back>
      {isGuest ? (
        <div className="card">
          <h2>Un compte est nécessaire</h2>
          <p className="muted">Pour proposer des paires de mots, crée ton compte (tes stats sont conservées).</p>
          <button className="btn btn-primary" onClick={() => nav('/profile')}>Créer mon compte</button>
        </div>
      ) : (
        <div className="card">
          <p className="muted">Deux mots proches, mais pas identiques : l'idéal pour semer le doute. Ex : <b>Bière</b> / <b>Cidre</b>.</p>
          <div className="field"><label>Mot des civils</label><input className="input" maxLength={40} value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="field"><label>Mot de l'undercover</label><input className="input" maxLength={40} value={b} onChange={(e) => setB(e.target.value)} /></div>
          <div className="field"><label>Catégorie</label>
            <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
              {[...new Set(['general', ...cats])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={send}>Envoyer</button>
        </div>
      )}
    </Page>
  )
}
