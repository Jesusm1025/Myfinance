import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from './AuthProvider'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-4 text-ink dark:bg-slate-950 dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-5 py-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" />
          <span>Preparando tu espacio...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }

  return children
}
