import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { Page, useToast } from '../components/ui'

export default function Profile() {
  const { isGuest, email, profile, pseudo, setPseudo, signUp, signIn, signOut } = useAuth()
  const { toast, fail } = useToast()
  const [name, setName] = useState(pseudo)
  const [mail, setMail] = useState('')
  const [pwd, setPwd] = useState('')
  const [mode, setMode] = useState<'up' | 'in'>('up')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try { const r = await fn(); toast(typeof r === 'string' ? r : (ok ?? 'C\'est fait ✅')) } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <Page title="Profil" back>
      <div className="card">
        <div className="row">
          <div className="avatar" style={{ background: 'var(--yellow)', width: 56, height: 56, fontSize: 24 }}>{(pseudo || '?').charAt(0).toUpperCase()}</div>
          <div className="grow"><h2>{pseudo || 'Joueur'}</h2><p className="muted">{isGuest ? 'Invité' : email}</p></div>
        </div>
        <div className="row">
          <div className="chip">🎮 {profile?.games_played ?? 0} parties</div>
          <div className="chip accent">🏆 {profile?.games_won ?? 0} victoires</div>
        </div>
      </div>

      <div className="card">
        <div className="field"><label htmlFor="p">Ton prénom</label>
          <input id="p" className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => run(() => setPseudo(name), 'Prénom enregistré')}>Enregistrer</button>
      </div>

      {isGuest ? (
        <div className="card">
          <h2>{mode === 'up' ? 'Créer mon compte' : 'Me connecter'}</h2>
          <p className="muted">{mode === 'up' ? 'Garde tes stats et propose tes propres mots.' : 'Retrouve ton compte existant.'}</p>
          <div className="field"><label htmlFor="m">Email</label><input id="m" type="email" className="input" value={mail} onChange={(e) => setMail(e.target.value)} autoComplete="email" /></div>
          <div className="field"><label htmlFor="w">Mot de passe</label><input id="w" type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></div>
          <button className="btn btn-primary" disabled={busy || !mail || pwd.length < 6}
            onClick={() => run(() => (mode === 'up' ? signUp(mail, pwd) : signIn(mail, pwd)))}>
            {mode === 'up' ? 'Créer mon compte' : 'Connexion'}
          </button>
          <button className="link" onClick={() => setMode(mode === 'up' ? 'in' : 'up')}>
            {mode === 'up' ? 'J\'ai déjà un compte' : 'Pas encore de compte ? En créer un'}
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={() => run(signOut, 'Déconnecté')}>Se déconnecter</button>
      )}
    </Page>
  )
}
