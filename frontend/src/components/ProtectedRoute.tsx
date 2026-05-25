import { Navigate } from 'react-router-dom'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  role?: UserRole
}

export default function ProtectedRoute({ children, role }: Props) {
  const token = localStorage.getItem('token')
  const storedRole = localStorage.getItem('role') as UserRole | null

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (role && storedRole !== role) {
    // Redirect to appropriate home
    if (storedRole === 'clinician') return <Navigate to="/clinician" replace />
    if (storedRole === 'patient') return <Navigate to="/dashboard" replace />
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
