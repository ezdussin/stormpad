import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { startDeepLinkListener } from './capacitor/deepLinks'
import { AppShell } from './components/AppShell'
import { SetupScreen } from './components/SetupScreen'
import { loadRepoConfig } from './db/settings'

export default function App() {
  const config = useLiveQuery(loadRepoConfig, [], 'loading' as const)

  useEffect(() => startDeepLinkListener(), [])

  if (config === 'loading') return null
  if (!config) return <SetupScreen />
  return <AppShell config={config} />
}
