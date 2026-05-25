import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { sessionApi, feedbackApi } from '../services/api'
import type { RitualSession, SessionFeedback } from '../types'

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-teal-100 text-teal-700',
  generating: 'bg-blue-100 text-blue-700',
  ready: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-500',
  scheduled: 'bg-slate-100 text-slate-500',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function RatingDot({ rating }: { rating: string }) {
  const color =
    rating === 'helping' ? 'bg-green-500' :
    rating === 'not_helping' ? 'bg-red-500' :
    'bg-slate-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={rating} />
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState<RitualSession[]>([])
  const [feedbackMap, setFeedbackMap] = useState<Record<string, SessionFeedback[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    sessionApi.getHistory().then(({ data }) => {
      setSessions(data)
      // Prefetch feedback for completed sessions
      const completed = data.filter((s: RitualSession) => s.status === 'completed')
      Promise.all(
        completed.map((s: RitualSession) =>
          feedbackApi.getAll(s.id).then(({ data: fb }) => ({ id: s.id, fb }))
        )
      ).then((results) => {
        const map: Record<string, SessionFeedback[]> = {}
        results.forEach(({ id, fb }) => { map[id] = fb })
        setFeedbackMap(map)
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/dashboard" className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-base font-semibold text-slate-800">Session history</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {sessions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">No sessions yet. Start your first session from the dashboard.</p>
            <Link to="/dashboard" className="mt-4 inline-block text-blue-700 text-sm font-medium">
              Go to dashboard →
            </Link>
          </div>
        )}

        {sessions.map((session) => {
          const feedback = feedbackMap[session.id] ?? []
          const overall = feedback.find((f) => f.phase === 'overall')
          const phaseRatings = feedback.filter((f) => f.in_session_rating && f.phase !== 'overall')
          const isExpanded = expanded === session.id

          return (
            <div key={session.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                className="w-full text-left px-4 py-4"
                onClick={() => setExpanded(isExpanded ? null : session.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Session {session.session_number} — {formatDate(session.session_date)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[session.status] ?? STATUS_BADGE.scheduled}`}>
                        {session.status.replace('_', ' ')}
                      </span>
                      {phaseRatings.length > 0 && (
                        <div className="flex gap-1 items-center">
                          {phaseRatings.map((f, i) => (
                            <RatingDot key={i} rating={f.in_session_rating!} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Intervention</p>
                      <p className="text-slate-700 font-medium text-xs">
                        {session.intervention_type.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Valence</p>
                      <p className="text-slate-700 font-medium text-xs">
                        {(session.valence_dial * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {phaseRatings.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Phase feedback</p>
                      <div className="flex gap-2">
                        {phaseRatings.map((f, i) => (
                          <div key={i} className="flex-1 text-center">
                            <p className="text-xs text-slate-400 capitalize">{f.phase}</p>
                            <p className={`text-xs font-medium mt-0.5 capitalize ${
                              f.in_session_rating === 'helping' ? 'text-green-600' :
                              f.in_session_rating === 'not_helping' ? 'text-red-600' :
                              'text-slate-500'
                            }`}>
                              {f.in_session_rating?.replace('_', ' ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {overall && (
                    <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                      <p className="text-xs text-slate-400 font-medium">Post-session</p>
                      {overall.post_pain_level && (
                        <p className="text-xs text-slate-700">Pain level: <span className="font-semibold">{overall.post_pain_level}/10</span></p>
                      )}
                      {overall.perceived_benefit && (
                        <p className="text-xs text-slate-700">Benefit: <span className="font-semibold">{overall.perceived_benefit}/5</span></p>
                      )}
                      {overall.post_session_notes && (
                        <p className="text-xs text-slate-600 italic mt-1">"{overall.post_session_notes}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}
