import { LOGO } from '../../lib/supabase'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Secret } from '../../lib/types'
import { roleEmoji, roleLabel, useToast } from '../ui'

interface Props {
  playerId: string
  name?: string
  /** si fourni, affiche le bouton « c'est noté » qui marque le joueur prêt */
  markReady?: boolean
  onDone?: () => void
}

// Carte secrète : cachée par défaut, un tap pour voir / recacher.
export default function SecretCard({ playerId, name, markReady, onDone }: Props) {
  const { fail } = useToast()
  const [secret, setSecret] = useState<Secret | null>(null)
  const [shown, setShown] = useState(false)
  const [seen, setSeen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.getSecret(playerId).then(setSecret).catch(fail) }, [playerId, fail])

  const action = Boolean(markReady || onDone)
  const toggle = () => { setShown((s) => !s); setSeen(true) }
  const done = async () => {
    setBusy(true)
    try { if (markReady) await api.markReady(playerId); onDone?.() } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <>
      <button className={`secret ${shown ? 'shown' : ''} ${shown && secret ? 'r-' + secret.role : ''}`} onClick={toggle} aria-label="Afficher ou cacher la carte">
        {!shown && (
          <div>
            <img src={LOGO} alt="" />
            <p className="hint">{name ? `Carte de ${name}` : 'Ta carte secrète'}</p>
            <p className="sub">Touche pour voir — personne ne doit regarder 👀</p>
          </div>
        )}
        {shown && secret && (
          <div>
            <p className="role">{roleEmoji[secret.role]} {roleLabel[secret.role]}</p>
            {secret.word
              ? <p className="word">{secret.word}</p>
              : <p className="word" style={{ fontSize: 26 }}>Tu n'as pas de mot !<br /><span className="muted" style={{ fontSize: 16, fontWeight: 600 }}>Écoute les autres et bluffe.</span></p>}
            <p className="sub">Touche pour cacher</p>
          </div>
        )}
        {shown && !secret && <div className="spinner" />}
      </button>
      {action && (
        <button className="btn btn-primary" disabled={!seen || shown || busy} onClick={done}>
          {markReady ? "J'ai mémorisé" : 'Fermer'}
        </button>
      )}
      {action && !seen && <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Regarde ta carte puis cache-la pour continuer.</p>}
      {action && seen && shown && <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Cache la carte avant de passer le téléphone.</p>}
    </>
  )
}
