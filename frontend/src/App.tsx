import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import RitualSession from './pages/RitualSession'
import SessionHistory from './pages/SessionHistory'
import ClinicianDashboard from './pages/ClinicianDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute role="patient">
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="patient">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:id"
          element={
            <ProtectedRoute role="patient">
              <RitualSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute role="patient">
              <SessionHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clinician"
          element={
            <ProtectedRoute role="clinician">
              <ClinicianDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
