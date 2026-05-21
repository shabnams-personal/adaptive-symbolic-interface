import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clinicianApi } from '../services/api'
import type { PatientSummary, AdaptationLog } from '../types'

interface PatientDetail {
  patient_id: string
  first_name: string
  email: string
  age: number
  gender: string
  pain_type: string
  pain_level_baseline: number
  current_valence_dial: number
  current_intervention_type: string
  adaptation_logs: AdaptationLog[]
}

interface SessionSummary {
  id: string
  session_number: number
  session_date: string
  status: string
  valence_dial: number
  intervention_type: string
  phase_ratings: string[]
  post_pain_level: number | null
  perceived_benefit: number | null
}

export default function ClinicianDashboard() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null)
  const [patientSessions, setPatientSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [view, setView] = useState<'list' | 'detail'>('list')

  useEffect(() => {
    clinicianApi.getPatients()
      .then(({ data }) => setPatients(data))
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [navigate])

  async function openPatient(patientId: string) {
    setDetailLoading(true)
    try {
      const [summaryRes, sessionsRes] = await Promise.all([
        clinicianApi.getPatientSummary(patientId),
        clinicianApi.getPatientSessions(patientId),
      ])
      setSelectedPatient(summaryRes.data)
      setPatientSessions(sessionsRes.data)
      setView('detail')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleSignOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === 'detail' && (
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-slate-800 text-sm">ASI Clinician Dashboard</span>
                {view === 'detail' && selectedPatient && (
                  <span className="text-slate-400 text-xs ml-2">— {selectedPatient.first_name}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Patient List */}
        {view === 'list' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Patients</h2>
              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-1">{patients.length} enrolled</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : patients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm">No patients enrolled yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {patients.map((p) => (
                  <button
                    key={p.patient_id}
                    onClick={() => openPatient(p.patient_id)}
                    disabled={detailLoading}
                    className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{p.first_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.email}</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-700">{p.sessions_completed}</p>
                        <p className="text-xs text-slate-400">completed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-teal-600">{(p.adherence_rate * 100).toFixed(0)}%</p>
                        <p className="text-xs text-slate-400">adherence</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-700">
                          {p.avg_pain_post != null ? p.avg_pain_post.toFixed(1) : '—'}
                        </p>
                        <p className="text-xs text-slate-400">avg pain post</p>
                      </div>
                    </div>
                    {p.last_session_date && (
                      <p className="text-xs text-slate-400 mt-2">Last session: {p.last_session_date}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Patient Detail */}
        {view === 'detail' && selectedPatient && (
          <div className="space-y-5">
            {/* Profile card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">{selectedPatient.first_name}'s profile</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ['Email', selectedPatient.email],
                  ['Age / Gender', `${selectedPatient.age} / ${selectedPatient.gender}`],
                  ['Pain type', selectedPatient.pain_type],
                  ['Baseline pain', `${selectedPatient.pain_level_baseline}/10`],
                  ['Current valence', `${(selectedPatient.current_valence_dial * 100).toFixed(0)}%`],
                  ['Intervention type', selectedPatient.current_intervention_type.replace('_', ' ')],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-400">{label}</dt>
                    <dd className="text-slate-700 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Adaptation log */}
            {selectedPatient.adaptation_logs.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-3">Adaptation history</h3>
                <div className="space-y-3">
                  {selectedPatient.adaptation_logs.map((log) => (
                    <div key={log.id} className="bg-slate-50 rounded-lg p-3 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-slate-400">{new Date(log.created_at).toLocaleDateString()}</span>
                        <span className="text-blue-600">
                          Valence: {(log.old_valence * 100).toFixed(0)}% → {(log.new_valence * 100).toFixed(0)}%
                        </span>
                        {log.old_intervention_type !== log.new_intervention_type && (
                          <span className="text-teal-600">
                            {log.old_intervention_type.replace('_', ' ')} → {log.new_intervention_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600">{log.trigger_reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions table */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Sessions</h3>
              {patientSessions.length === 0 ? (
                <p className="text-sm text-slate-400">No sessions yet.</p>
              ) : (
                <div className="space-y-2">
                  {patientSessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">#{s.session_number}</span>
                        <span className="text-slate-400 ml-2">{s.session_date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {s.post_pain_level && <span>Pain: {s.post_pain_level}/10</span>}
                        {s.perceived_benefit && <span>Benefit: {s.perceived_benefit}/5</span>}
                        <span className={`px-2 py-0.5 rounded-full ${
                          s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
