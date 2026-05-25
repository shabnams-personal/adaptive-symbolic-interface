export type UserRole = 'patient' | 'clinician'

export interface User {
  id: string
  email: string
  role: UserRole
}

export type TonePreference = 'direct_informative' | 'balanced' | 'supportive_sustaining'
export type VoicePreference = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
export type InterventionType = 'cognitive_reframing' | 'interoceptive_attention'

export interface PatientProfile {
  id: string
  user_id: string
  first_name: string
  age: number
  gender: string
  pain_type: string
  pain_level_baseline: number
  treatment_context: string
  tone_preference: TonePreference
  voice_preference: VoicePreference
  communication_style: string
  current_valence_dial: number
  current_intervention_type: InterventionType
  created_at: string
  updated_at: string
}

export type SessionStatus =
  | 'scheduled'
  | 'generating'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed'

export type SessionPhase = 'before' | 'during' | 'after'

export interface RitualSession {
  id: string
  patient_id: string
  session_number: number
  session_date: string
  status: SessionStatus
  error_message: string | null
  current_phase: SessionPhase | null
  script_before: string | null
  script_during: string | null
  script_after: string | null
  audio_before_path: string | null
  audio_during_path: string | null
  audio_after_path: string | null
  intervention_type: InterventionType
  valence_dial: number
  duration_seconds: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type FeedbackPhase = 'before' | 'during' | 'after' | 'overall'
export type InSessionRating = 'helping' | 'neutral' | 'not_helping'

export interface SessionFeedback {
  id: string
  session_id: string
  phase: FeedbackPhase
  in_session_rating: InSessionRating | null
  post_pain_level: number | null
  post_session_notes: string | null
  perceived_benefit: number | null
  created_at: string
}

export interface AdaptationLog {
  id: string
  patient_id: string
  session_id: string
  old_valence: number
  new_valence: number
  old_intervention_type: InterventionType
  new_intervention_type: InterventionType
  trigger_reason: string
  created_at: string
}

export interface PatientSummary {
  patient_id: string
  first_name: string
  email: string
  sessions_completed: number
  total_sessions: number
  adherence_rate: number
  avg_pain_baseline: number
  avg_pain_post: number | null
  last_session_date: string | null
}
