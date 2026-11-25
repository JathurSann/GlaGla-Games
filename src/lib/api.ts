import { supabase } from './supabase'
import type { Profile, Reveal, Secret, Settings } from './types'

const messages: Record<string, string> = {
  room_not_found: "Ce salon n'existe pas. Vérifie le code.",
  game_already_started: 'La partie a déjà commencé.',
  room_full: 'Le salon est plein (20 joueurs max).',
  name_taken: 'Ce prénom est déjà pris dans le salon.',
  invalid_name: 'Choisis un prénom (1 à 20 caractères).',
  not_enough_players: 'Il faut au moins 3 joueurs.',
  too_many_impostors: "Trop d'infiltrés pour ce nombre de joueurs.",
  no_words: 'Aucune paire de mots disponible pour cette sélection.',
  players_not_ready: "Tout le monde n'a pas encore vu sa carte.",
  not_authenticated: 'Connexion en cours… réessaie dans un instant.',
  too_early: 'Le débat est encore en cours.',
  cannot_vote_self: 'Tu ne peux pas voter pour toi-même.',
  forbidden: "Action non autorisée.",
}

export function errMsg(e: unknown): string {
  const raw = (e as { message?: string })?.message ?? String(e)
  return messages[raw] ?? raw
}

async function rpc<T = void>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const api = {
  createRoom: (name: string) => rpc<{ room_id: string; code: string; player_id: string }>('create_room', { p_name: name }),
  joinRoom: (code: string, name: string) => rpc<{ room_id: string; code: string; player_id: string }>('join_room', { p_code: code, p_name: name }),
  addLocalPlayer: (room: string, name: string) => rpc<string>('add_local_player', { p_room: room, p_name: name }),
  removePlayer: (player: string) => rpc('remove_player', { p_player: player }),
  updateSettings: (room: string, s: Partial<Settings>) => rpc('update_settings', { p_room: room, p_settings: s }),
  startGame: (room: string) => rpc('start_game', { p_room: room }),
  getSecret: (player: string) => rpc<Secret>('get_my_secret', { p_player: player }),
  markReady: (player: string) => rpc('mark_ready', { p_player: player }),
  beginDebate: (room: string) => rpc('begin_debate', { p_room: room }),
  extendDebate: (room: string, seconds = 60) => rpc('extend_debate', { p_room: room, p_seconds: seconds }),
  startVote: (room: string) => rpc('start_vote', { p_room: room }),
  castVote: (voter: string, target: string) => rpc('cast_vote', { p_voter: voter, p_target: target }),
  forceResolve: (room: string) => rpc('force_resolve', { p_room: room }),
  mrWhiteGuess: (room: string, guess: string) => rpc<boolean>('mrwhite_guess', { p_room: room, p_guess: guess }),
  nextRound: (room: string) => rpc('next_round', { p_room: room }),
  getReveal: (room: string) => rpc<Reveal>('get_reveal', { p_room: room }),
  playAgain: (room: string) => rpc('play_again', { p_room: room }),
}

export async function fetchCategories(): Promise<string[]> {
  const { data } = await supabase.from('word_pairs').select('category').eq('approved', true)
  return [...new Set((data ?? []).map((r: { category: string }) => r.category))].sort()
}

export async function suggestPair(civil: string, undercover: string, category: string) {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('not_authenticated')
  const { error } = await supabase.from('word_pairs').insert({
    civil_word: civil.trim(), undercover_word: undercover.trim(), category, lang: 'fr', submitted_by: u.user.id,
  })
  if (error) throw new Error(error.code === '23505' ? 'Cette paire existe déjà.' : error.message)
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  return (data as Profile) ?? null
}
