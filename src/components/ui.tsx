import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { errMsg } from '../lib/api'
import { useAuth } from '../lib/auth'

const PALETTE = ['#F5BB00', '#8EA604', '#EC9F05', '#D76A03', '#BF3100']
export const seatColor = (seat: number) => PALETTE[seat % PALETTE.length]

export function Avatar({ name, seat }: { name: string; seat: number }) {
  return <div className="avatar" style={{ background: seatColor(seat) }}>{name.trim().charAt(0).toUpperCase() || '?'}</div>
}

export function Spinner({ label }: { label?: string }) {
  return <div className="center"><div className="spinner" />{label && <p className="muted">{label}</p>}</div>
}

/* ---- Toasts ---- */
interface ToastCtx { toast: (m: string, kind?: 'ok' | 'err') => void; fail: (e: unknown) => void }
const Toast = createContext<ToastCtx>({ toast: () => {}, fail: () => {} })
export const useToast = () => useContext(Toast)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; kind: 'ok' | 'err'; k: number } | null>(null)
  const toast = useCallback((m: string, kind: 'ok' | 'err' = 'ok') => {
    const k = Date.now(); setT({ m, kind, k })
    setTimeout(() => setT((c) => (c?.k === k ? null : c)), 3200)
  }, [])
  const fail = useCallback((e: unknown) => toast(errMsg(e), 'err'), [toast])
  return (
    <Toast.Provider value={{ toast, fail }}>
      {children}
      {t && <div className={`toast ${t.kind === 'err' ? 'err' : ''}`} role="status">{t.m}</div>}
    </Toast.Provider>
  )
}

/* ---- En-tête ---- */
export function Header({ title, back }: { title?: string; back?: string | boolean }) {
  const nav = useNavigate()
  const { isGuest } = useAuth()
  return (
    <header className="header">
      {back ? (
        <button className="round-btn" aria-label="Retour" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>←</button>
      ) : (
        <button className="round-btn" aria-label="Accueil" onClick={() => nav('/')}><img src="/logo.svg" alt="" /></button>
      )}
      <h1>{title ?? 'GlaGla Jeux'}</h1>
      <button className="round-btn" aria-label="Profil" onClick={() => nav('/profile')}>{isGuest ? '👤' : '😎'}</button>
    </header>
  )
}

export function Page({ title, back, children }: { title?: string; back?: string | boolean; children: ReactNode }) {
  return (
    <>
      <Header title={title} back={back} />
      <main className="page">{children}</main>
    </>
  )
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} disabled={disabled} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
}

export const roleLabel = { civil: 'Civil', undercover: 'Undercover', mrwhite: 'Mr. White' } as const
export const roleEmoji = { civil: '😇', undercover: '🕵️', mrwhite: '⚪' } as const
