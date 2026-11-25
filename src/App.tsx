import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { Spinner, ToastProvider } from './components/ui'
import Home from './pages/Home'
import UndercoverHub from './pages/UndercoverHub'
import Suggest from './pages/Suggest'
import Profile from './pages/Profile'
import RoomPage from './pages/Room'

function NotConfigured() {
  return (
    <main className="page" style={{ paddingTop: 48 }}>
      <img src="/logo.svg" alt="" style={{ width: 90, margin: '0 auto' }} />
      <h1 className="section-title" style={{ textAlign: 'center' }}>Connexion Supabase manquante</h1>
      <div className="card">
        <p>Crée un fichier <code>.env</code> à la racine avec :</p>
        <p><code>VITE_SUPABASE_URL</code><br /><code>VITE_SUPABASE_ANON_KEY</code></p>
        <p className="muted">Puis applique <code>supabase/migrations/0001_init.sql</code> et <code>supabase/seed.sql</code>. Détails dans le README.</p>
      </div>
    </main>
  )
}

function Shell() {
  const { ready, userId, error } = useAuth()
  if (!isConfigured) return <NotConfigured />
  if (!ready) return <Spinner label="Connexion…" />
  if (!userId) {
    return (
      <main className="page" style={{ paddingTop: 48 }}>
        <h1 className="section-title">Connexion impossible</h1>
        <div className="card">
          <p>{error ?? 'Impossible de se connecter.'}</p>
          <p className="muted">Active « Allow anonymous sign-ins » dans Supabase → Authentication → Sign In / Providers.</p>
        </div>
      </main>
    )
  }
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/undercover" element={<UndercoverHub />} />
      <Route path="/undercover/mots" element={<Suggest />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="/join/:code" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <div className="app"><Shell /></div>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  )
}
