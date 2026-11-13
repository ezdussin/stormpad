import { useLiveQuery } from 'dexie-react-hooks'
import { AppShell } from './components/AppShell'
import { SetupScreen } from './components/SetupScreen'
import { loadRepoConfig } from './db/settings'

export default function App() {
  const config = useLiveQuery(loadRepoConfig, [], 'loading' as const)

  if (config === 'loading') return null
  if (!config) return <SetupScreen />
  return <AppShell config={config} />
}
