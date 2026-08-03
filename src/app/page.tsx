'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import { WelcomeScreen } from '@/components/teenmind/screens/welcome'
import { LoadingScreen } from '@/components/teenmind/screens/loading'
import { LoginScreen } from '@/components/teenmind/screens/login'

// PERF (audit finding): this file used to statically import RespondentApp
// AND AdminLoginScreen AND AdminDashboard. AdminDashboard alone pulls in
// recharts, framer-motion, react-markdown, and (via CohortPanel) all 9
// statistics panels — regression/factor/cluster/logistic/mediation/
// moderation/partial-corr/crosstab/reliability. Because everything was
// imported eagerly at the top of this client component, EVERY visitor —
// including a student who only ever fills out the survey — downloaded and
// parsed the entire admin analytics bundle before seeing the welcome
// screen. That is the single biggest contributor to "Loading awal sangat
// lama". Splitting these into their own chunks means each one only loads
// when its mode is actually reached.
const RespondentApp = dynamic(
  () => import('@/components/teenmind/screens/respondent-app').then((m) => m.RespondentApp),
  { loading: () => <ScreenFallback /> }
)
const AdminLoginScreen = dynamic(
  () => import('@/components/teenmind/screens/admin-login').then((m) => m.AdminLoginScreen),
  { loading: () => <ScreenFallback /> }
)
const AdminDashboard = dynamic(
  () => import('@/components/teenmind/screens/admin-dashboard').then((m) => m.AdminDashboard),
  { loading: () => <ScreenFallback /> }
)

function ScreenFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-mesh">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 to-teal-300 text-3xl shadow-lg animate-pulse">
        🧠
      </div>
    </div>
  )
}

export default function Home() {
  const mode = useAppStore((s) => s.mode)
  const setMode = useAppStore((s) => s.setMode)
  const session = useAppStore((s) => s.session)
  const hydrateFromServer = useAppStore((s) => s.hydrateFromServer)
  const setSession = useAppStore((s) => s.setSession)
  const [bootChecked, setBootChecked] = useState(false)

  // On mount: try to resume an existing session
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/progress')
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          if (data && data.code) {
            setSession({
              code: data.code,
              school: data.school,
              status: data.status,
              currentStage: data.currentStage,
              stageIndex: data.stageIndex,
              highRisk: data.highRisk,
              consentGiven: data.consentGiven,
              respondentId: '',
            })
            hydrateFromServer({
              currentStage: data.currentStage,
              stageIndex: data.stageIndex,
              highRisk: data.highRisk,
              consentGiven: data.consentGiven,
              status: data.status,
              answers: data.answers,
            })
            // If respondent has a session and is on a respondent stage, go straight to respondent app
            if (data.currentStage && data.currentStage !== 'complete') {
              setMode('respondent')
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setBootChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // After loading screen completes, switch to respondent app
  function handleLoadingDone() {
    setMode('respondent')
  }

  if (!bootChecked) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-mesh">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 to-teal-300 text-3xl shadow-lg animate-pulse">
            🧠
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-primary"
                style={{ animation: `pulse 1s ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  switch (mode) {
    case 'welcome':
      return <WelcomeScreen />
    case 'loading':
      return <LoadingScreen onDone={handleLoadingDone} />
    case 'login':
      return <LoginScreen />
    case 'admin-login':
      return <AdminLoginScreen />
    case 'admin':
      return <AdminDashboard />
    case 'respondent':
      return session ? <RespondentApp /> : <LoginScreen />
    default:
      return <WelcomeScreen />
  }
}
