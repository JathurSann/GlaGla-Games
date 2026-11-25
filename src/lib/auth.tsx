import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './supabase'
import { fetchProfile } from './api'
import type { Profile } from './types'

interface AuthCtx {
  ready: boolean
  userId: string | null
  isGuest: boolean
  email: string | null
  profile: Profile | null
  pseudo: string
  error: string | null
  refreshProfile: () => Promise<void>
  setPseudo: (p: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as never)
export const useAuth = () => useContext(Ctx)

const LS_PSEUDO = 'glagla:pseudo'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured) { setReady(true); return }
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        const { data: d, error: e } = await supabase.auth.signInAnonymously()
        if (e) setError(e.message)
        if (alive) setSession(d?.session ?? null)
      } else if (alive) setSession(data.session)
      if (alive) setReady(true)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => alive && setSession(s))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const userId = session?.user.id ?? null

  const refreshProfile = useCallback(async () => {
    if (userId) setProfile(await fetchProfile(userId))
    else setProfile(null)
  }, [userId])
  useEffect(() => { void refreshProfile() }, [refreshProfile])

  const pseudo = profile?.pseudo && profile.pseudo !== 'Joueur'
    ? profile.pseudo
    : (localStorage.getItem(LS_PSEUDO) ?? '')

  const value = useMemo<AuthCtx>(() => ({
    ready, userId, error, profile, pseudo,
    isGuest: Boolean(session?.user.is_anonymous),
    email: session?.user.email ?? null,
    refreshProfile,
    async setPseudo(p) {
      const v = p.trim().slice(0, 20)
      localStorage.setItem(LS_PSEUDO, v)
      if (userId && v) {
        await supabase.from('profiles').update({ pseudo: v }).eq('id', userId)
        await refreshProfile()
      }
    },
    // Transforme le compte invité en vrai compte (même identité, stats conservées).
    async signUp(email, password) {
      const { error: e } = await supabase.auth.updateUser({ email, password })
      if (e) throw new Error(e.message)
      return 'Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.'
    },
    async signIn(email, password) {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password })
      if (e) throw new Error(e.message)
    },
    async signOut() {
      await supabase.auth.signOut()
      const { data } = await supabase.auth.signInAnonymously()
      setSession(data.session)
    },
  }), [ready, userId, error, profile, pseudo, session, refreshProfile])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
