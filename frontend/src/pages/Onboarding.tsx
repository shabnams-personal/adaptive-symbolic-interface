import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientApi } from '../services/api'

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other']
const TONES = [
  {
    value: 'direct_informative',
    label: 'Direct & Informative',
    desc: 'Clear, factual guidance focused on what to do',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    desc: 'A mix of practical information and emotional support',
  },
  {
    value: 'supportive_sustaining',
    label: 'Supportive & Sustaining',
    desc: 'Warm, encouraging language focused on how you feel',
  },
]

interface FormData {
  first_name: string
  age: string
  gender: string
  pain_type: string
  pain_level_baseline: number
  treatment_context: string
  tone_preference: string
  voice_preference: string
  communication_style: string
}

const TOTAL_STEPS = 4

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [form, setForm] = useState<FormData>({
    first_name: '',
    age: '',
    gender: '',
    pain_type: '',
    pain_level_baseline: 5,
    treatment_context: '',
    tone_preference: 'balanced',
    voice_preference: 'nova',
    communication_style: '',
  })

  function update(field: keyof FormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function playVoiceSample(voice: string) {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (playingVoice === voice) {
      setPlayingVoice(null)
      return
    }
    const audio = new Audio(`/voice-samples/${voice}.mp3`)
    audioRef.current = audio
    audio.play().catch(() => {/* samples may not exist yet in dev */})
    setPlayingVoice(voice)
    audio.onended = () => setPlayingVoice(null)
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      await patientApi.createProfile({
        ...form,
        age: parseInt(form.age),
        pain_level_baseline: form.pain_level_baseline,
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to save profile. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200 z-10">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <p className="text-sm text-slate-500">
            Step {step} of {TOTAL_STEPS}
          </p>
          <div className="flex justify-center gap-2 mt-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Step 1 — Basic Info */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Welcome to ASI</h2>
              <p className="text-sm text-slate-500 mb-6">
                Let's start with some basic information about you.
              </p>
              <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs mb-6">
                This is a research prototype supporting your medical treatment. It does not replace clinical care.
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    required
                    min={18}
                    max={120}
                    value={form.age}
                    onChange={(e) => update('age', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => update('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select…</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Pain Profile */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Your pain profile</h2>
              <p className="text-sm text-slate-500 mb-6">
                This helps us personalise your sessions to your specific situation.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type of pain</label>
                  <input
                    type="text"
                    required
                    value={form.pain_type}
                    onChange={(e) => update('pain_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Chronic lower back pain, neuropathic pain"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Baseline pain level:{' '}
                    <span className="font-semibold text-blue-700">{form.pain_level_baseline}/10</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={form.pain_level_baseline}
                    onChange={(e) => update('pain_level_baseline', parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>1 — Mild</span>
                    <span>10 — Severe</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Current treatment context{' '}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={form.treatment_context}
                    onChange={(e) => update('treatment_context', e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="e.g. Currently taking ibuprofen, awaiting physiotherapy"
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">
                    {form.treatment_context.length}/500
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Preferences */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Your preferences</h2>
              <p className="text-sm text-slate-500 mb-6">
                Choose the tone and voice that feels right for you.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Communication tone</label>
                  <div className="space-y-2">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => update('tone_preference', t.value)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          form.tone_preference === t.value
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <p className={`text-sm font-medium ${form.tone_preference === t.value ? 'text-blue-800' : 'text-slate-700'}`}>
                          {t.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Voice preference{' '}
                    <span className="text-slate-400 font-normal text-xs">(tap to preview)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {VOICES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          update('voice_preference', v)
                          playVoiceSample(v)
                        }}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                          form.voice_preference === v
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {playingVoice === v ? (
                          <span className="text-blue-600">▶</span>
                        ) : (
                          <span className="text-slate-400">♪</span>
                        )}
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Anything else about how you'd like to be spoken to?{' '}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={form.communication_style}
                    onChange={(e) => update('communication_style', e.target.value)}
                    maxLength={300}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="e.g. Keep it brief, avoid medical jargon"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Review your profile</h2>
              <p className="text-sm text-slate-500 mb-6">
                Please confirm these details are correct before we start.
              </p>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <dl className="space-y-3 text-sm">
                {[
                  ['Name', form.first_name],
                  ['Age', form.age],
                  ['Gender', form.gender],
                  ['Pain type', form.pain_type],
                  ['Baseline pain', `${form.pain_level_baseline}/10`],
                  ['Treatment context', form.treatment_context || '—'],
                  ['Tone preference', TONES.find((t) => t.value === form.tone_preference)?.label ?? form.tone_preference],
                  ['Voice', form.voice_preference.charAt(0).toUpperCase() + form.voice_preference.slice(1)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-slate-800 font-medium text-right max-w-[200px]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => {
                // Basic validation
                if (step === 1 && (!form.first_name || !form.age || !form.gender)) return
                if (step === 2 && !form.pain_type) return
                setStep((s) => s + 1)
              }}
              className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Saving…' : 'Confirm & start'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
