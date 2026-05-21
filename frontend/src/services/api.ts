import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// Auth
export const authApi = {
  register: (data: { email: string; password: string; role: string; invite_code?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; token_type: string }>('/auth/login', data),
  me: () => api.get<{ id: string; email: string; role: string }>('/users/me'),
}

// Patient
export const patientApi = {
  createProfile: (data: Record<string, unknown>) => api.post('/patients/profile', data),
  getProfile: () => api.get('/patients/profile'),
}

// Sessions
export const sessionApi = {
  generate: () => api.post('/sessions/generate'),
  getCurrent: () => api.get('/sessions/current'),
  getHistory: () => api.get('/sessions/history'),
  getById: (id: string) => api.get(`/sessions/${id}`),
  updateSession: (id: string, data: { status?: string; current_phase?: string | null }) =>
    api.patch(`/sessions/${id}`, data),
  getAudioUrl: (id: string, phase: string) => `/api/sessions/${id}/audio/${phase}`,
}

// Feedback
export const feedbackApi = {
  submit: (
    sessionId: string,
    data: {
      phase: string
      in_session_rating?: string
      post_pain_level?: number
      post_session_notes?: string
      perceived_benefit?: number
    }
  ) => api.post(`/sessions/${sessionId}/feedback`, data),
  getAll: (sessionId: string) => api.get(`/sessions/${sessionId}/feedback`),
}

// Clinician
export const clinicianApi = {
  getPatients: () => api.get('/clinician/patients'),
  getPatientSummary: (id: string) => api.get(`/clinician/patients/${id}/summary`),
  getPatientSessions: (id: string) => api.get(`/clinician/patients/${id}/sessions`),
}
