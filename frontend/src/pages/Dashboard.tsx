import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { sessionApi, patientApi } from '../services/api'
import type { RitualSession, PatientProfile } from '../types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ready: { label: 'Ready to start', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  generating: { label: 'Preparing your session…', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  in_progress: { label: 'In progress', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  completed: { label: 'Completed today', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  failed: { label: 'Generation failed', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  scheduled: { label: 'Scheduled', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  skipped: { label: 'Skipped', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [session, setSession] = useState<RitualSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [profileRes, sessionRes] = await Promise.allSettled([
        patientApi.getProfile(),
        sessionApi.getCurrent(),
      ])
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data)
      } else {
        navigate('/onboarding')
        return
      }
      if (sessionRes.status === 'fulfilled') {
        setSession(sessionRes.value.data)
      }
    } catch {
      // Profile fetch failed — redirect to onboarding
      navigate('/onboarding')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Poll while session is generating
  useEffect(() => {
    if (session?.status !== 'generating') return
    const interval = setInterval(async () => {
      try {
        const { data } = await sessionApi.getCurrent()
        setSession(data)
        if (data.status !== 'generating') clearInterval(interval)
      } catch {
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [session?.status])

  async function handleStartSession() {
    setGenerating(true)
    setError('')
    try {
      const { data } = await sessionApi.generate()
      setSession(data)
      if (data.status === 'ready' || data.status === 'in_progress') {
        navigate(`/session/${data.id}`)
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to start session generation'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  function handleOpenSession() {
    if (session) navigate(`/session/${session.id}`)
  }

  function handleSignOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    )
  }

  const statusConf = session ? (STATUS_CONFIG[session.status] ?? STATUS_CONFIG.scheduled) : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm">ASI Portal</span>
          </div>
          <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Hello, {profile?.first_name} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your personalised session is ready when you are.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Today's Session Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Today's session</p>

          {!session ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500 mb-4">No session generated yet for today.</p>
              <button
                onClick={handleStartSession}
                disabled={generating}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors"
              >
                {generating ? 'Starting generation…' : 'Generate today\'s session'}
              </button>
            </div>
          ) : (
            <div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 ${statusConf?.bg}`}>
                {session.status === 'generating' && (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${statusConf?.color}`}>{statusConf?.label}</span>
              </div>

              {session.status === 'generating' && (
                <p className="text-xs text-slate-400 text-center mb-3">
                  Generating your personalised audio session… this takes about 30-60 seconds.
                </p>
              )}

              {session.status === 'failed' && (
                <div className="mb-4">
                  {session.error_message && (
                    <p className="text-xs text-red-600 mb-3">{session.error_message}</p>
                  )}
                  <button
                    onClick={handleStartSession}
                    disabled={generating}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    Retry generation
                  </button>
                </div>
              )}

              {(session.status === 'ready' || session.status === 'in_progress') && (
                <button
                  onClick={handleOpenSession}
                  className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors"
                >
                  {session.status === 'in_progress' ? 'Continue session' : 'Start today\'s session'}
                </button>
              )}

              {session.status === 'completed' && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 text-green-700 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Session complete for today
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Come back tomorrow for your next session.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">
              {session?.session_number ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Sessions total</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">
              {profile?.pain_level_baseline ?? '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Baseline pain /10</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          <Link
            to="/history"
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm text-slate-700">Session history</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            to="/onboarding"
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm text-slate-700">Update preferences</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </nav>
      </main>
    </div>
  )
}
