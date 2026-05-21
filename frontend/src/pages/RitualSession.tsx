import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sessionApi, feedbackApi } from '../services/api'
import type { RitualSession as Session, SessionPhase, InSessionRating } from '../types'
import AudioPlayer from '../components/AudioPlayer'

type AppPhase = 'loading' | 'before' | 'before_feedback' | 'treatment_cue' | 'during' | 'during_feedback' | 'after_cue' | 'after' | 'after_feedback' | 'post_session' | 'done'

const PHASE_LABELS: Record<string, string> = {
  before: 'Before treatment',
  during: 'During treatment',
  after: 'After treatment',
}

const PHASE_ORDER: SessionPhase[] = ['before', 'during', 'after']

export default function RitualSession() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<Session | null>(null)
  const [appPhase, setAppPhase] = useState<AppPhase>('loading')
  const [, setPhaseFeedback] = useState<InSessionRating | null>(null)
  const [postPainLevel, setPostPainLevel] = useState(5)
  const [perceivedBenefit, setPerceivedBenefit] = useState<number | null>(null)
  const [postNotes, setPostNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    sessionApi.getById(id).then(({ data }) => {
      setSession(data)
      // Mark session as in_progress
      sessionApi.updateSession(id, { status: 'in_progress', current_phase: 'before' })
      setAppPhase('before')
    }).catch(() => navigate('/dashboard'))
  }, [id, navigate])

  async function submitPhaseFeedback(phase: SessionPhase, rating: InSessionRating) {
    if (!id) return
    setPhaseFeedback(null)
    try {
      await feedbackApi.submit(id, {
        phase,
        in_session_rating: rating,
      })
    } catch {
      // Non-critical — continue regardless
    }
  }

  function handlePhaseAudioEnded(phase: SessionPhase) {
    if (phase === 'before') setAppPhase('before_feedback')
    else if (phase === 'during') setAppPhase('after_cue')
    else if (phase === 'after') setAppPhase('after_feedback')
  }

  async function handleBeforeFeedbackSubmit(rating: InSessionRating) {
    if (!id) return
    await submitPhaseFeedback('before', rating)
    sessionApi.updateSession(id, { current_phase: 'during' })
    setAppPhase('treatment_cue')
  }

  function handleTreatmentCueDone() {
    setAppPhase('during')
  }

  async function handleDuringFeedbackSubmit(rating: InSessionRating) {
    if (!id) return
    await submitPhaseFeedback('during', rating)
    sessionApi.updateSession(id, { current_phase: 'after' })
    setAppPhase('after')
  }

  async function handleAfterFeedbackSubmit(rating: InSessionRating) {
    if (!id) return
    await submitPhaseFeedback('after', rating)
    setAppPhase('post_session')
  }

  async function handlePostSessionSubmit() {
    if (!id || perceivedBenefit === null) return
    setSubmitting(true)
    setError('')
    try {
      await feedbackApi.submit(id, {
        phase: 'overall',
        post_pain_level: postPainLevel,
        perceived_benefit: perceivedBenefit,
        post_session_notes: postNotes || undefined,
      })
      await sessionApi.updateSession(id, { status: 'completed', current_phase: null })
      setAppPhase('done')
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Failed to submit feedback'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const getAudioUrl = (phase: string) =>
    session ? sessionApi.getAudioUrl(session.id, phase) : ''

  const currentPhaseIndex = (() => {
    if (appPhase.startsWith('before')) return 0
    if (appPhase === 'treatment_cue') return 1
    if (appPhase.startsWith('during') || appPhase === 'after_cue') return 1
    if (appPhase.startsWith('after') || appPhase === 'post_session' || appPhase === 'done') return 2
    return 0
  })()

  if (appPhase === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/60">Loading your session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white/60 hover:text-white text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
          <span className="text-white/60 text-xs">Session {session.session_number}</span>
        </div>

        {/* Phase indicator */}
        <div className="max-w-md mx-auto mt-4 flex gap-2">
          {PHASE_ORDER.map((p, i) => (
            <div key={p} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= currentPhaseIndex ? 'bg-white' : 'bg-white/20'
                }`}
              />
              <p className={`text-xs mt-1 text-center ${i === currentPhaseIndex ? 'text-white' : 'text-white/40'}`}>
                {PHASE_LABELS[p]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-4 py-6 max-w-md mx-auto w-full">

        {/* BEFORE phase */}
        {appPhase === 'before' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-white/60 text-sm uppercase tracking-widest mb-1">Before treatment</p>
              <h2 className="text-white text-xl font-semibold">Prepare your mind</h2>
            </div>
            <AudioPlayer
              src={getAudioUrl('before')}
              autoPlay
              onEnded={() => handlePhaseAudioEnded('before')}
            />
          </div>
        )}

        {/* BEFORE feedback */}
        {appPhase === 'before_feedback' && (
          <FeedbackPrompt
            question="How was this preparation for you?"
            onSubmit={handleBeforeFeedbackSubmit}
          />
        )}

        {/* Treatment cue */}
        {appPhase === 'treatment_cue' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/40 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold mb-2">Take your treatment now</h2>
              <p className="text-white/60 text-sm">Take your medication or apply your treatment as prescribed. When you're ready, continue to the next phase.</p>
            </div>
            <button
              onClick={handleTreatmentCueDone}
              className="w-full py-3.5 bg-white text-blue-800 font-semibold rounded-xl shadow-lg hover:bg-blue-50 transition-colors"
            >
              I've taken my treatment — continue
            </button>
          </div>
        )}

        {/* DURING phase */}
        {appPhase === 'during' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-white/60 text-sm uppercase tracking-widest mb-1">During treatment</p>
              <h2 className="text-white text-xl font-semibold">Focus your attention</h2>
            </div>
            <AudioPlayer
              src={getAudioUrl('during')}
              autoPlay
              onEnded={() => handlePhaseAudioEnded('during')}
            />
          </div>
        )}

        {/* After cue */}
        {appPhase === 'after_cue' && (
          <FeedbackPrompt
            question="How was the during-treatment guidance?"
            onSubmit={handleDuringFeedbackSubmit}
          />
        )}

        {/* AFTER phase */}
        {appPhase === 'after' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-white/60 text-sm uppercase tracking-widest mb-1">After treatment</p>
              <h2 className="text-white text-xl font-semibold">Reinforce the experience</h2>
            </div>
            <AudioPlayer
              src={getAudioUrl('after')}
              autoPlay
              onEnded={() => handlePhaseAudioEnded('after')}
            />
          </div>
        )}

        {/* After feedback */}
        {appPhase === 'after_feedback' && (
          <FeedbackPrompt
            question="How was the closing reflection?"
            onSubmit={handleAfterFeedbackSubmit}
          />
        )}

        {/* Post-session form */}
        {appPhase === 'post_session' && (
          <div className="bg-white rounded-2xl p-6 space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-800">Session complete</h2>
              <p className="text-sm text-slate-500 mt-1">Just a few quick questions to help personalise future sessions.</p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current pain level: <span className="text-blue-700 font-bold">{postPainLevel}/10</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={postPainLevel}
                onChange={(e) => setPostPainLevel(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1 — Mild</span>
                <span>10 — Severe</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                How beneficial did you find this session?
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPerceivedBenefit(n)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      perceivedBenefit === n
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'border-slate-200 text-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Not helpful</span>
                <span>Very helpful</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Any notes? <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={postNotes}
                onChange={(e) => setPostNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="How are you feeling? Anything you'd like to share…"
              />
            </div>

            <button
              onClick={handlePostSessionSubmit}
              disabled={submitting || perceivedBenefit === null}
              className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors"
            >
              {submitting ? 'Saving…' : 'Complete session'}
            </button>
          </div>
        )}

        {/* Done */}
        {appPhase === 'done' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold mb-2">Well done!</h2>
              <p className="text-white/60 text-sm">Your session is complete. Your feedback helps us personalise future sessions for you.</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 bg-white text-blue-800 font-semibold rounded-xl shadow-lg hover:bg-blue-50 transition-colors"
            >
              Return to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface FeedbackPromptProps {
  question: string
  onSubmit: (rating: InSessionRating) => void
}

function FeedbackPrompt({ question, onSubmit }: FeedbackPromptProps) {
  const options: { value: InSessionRating; label: string; emoji: string }[] = [
    { value: 'helping', label: 'Helping', emoji: '👍' },
    { value: 'neutral', label: 'Neutral', emoji: '🤷' },
    { value: 'not_helping', label: 'Not helping', emoji: '👎' },
  ]

  return (
    <div className="text-center space-y-5">
      <p className="text-white text-lg font-medium">{question}</p>
      <div className="flex gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSubmit(opt.value)}
            className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-4 text-white transition-colors"
          >
            <div className="text-2xl mb-1">{opt.emoji}</div>
            <div className="text-xs">{opt.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
