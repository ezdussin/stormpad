import { ChevronRight } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import {
  DEFAULT_BRANCH,
  DEFAULT_REPO,
  loadRepoPrefs,
  saveRepoConfig,
  saveRepoPrefs,
  type RepoPrefs,
} from '../db/settings'
import { validateRepoConfig } from '../sync/GitHubSyncService'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500'

export function SetupScreen() {
  const [token, setToken] = useState('')
  const [prefs, setPrefs] = useState<RepoPrefs>({ owner: '', repo: DEFAULT_REPO, branch: DEFAULT_BRANCH })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void loadRepoPrefs().then((saved) => {
      setPrefs(saved)
      if (saved.owner || saved.repo !== DEFAULT_REPO || saved.branch !== DEFAULT_BRANCH) {
        setAdvancedOpen(true)
      }
    })
  }, [])

  function updatePref(field: keyof RepoPrefs, value: string) {
    setPrefs((current) => ({ ...current, [field]: value }))
    void saveRepoPrefs({ [field]: value })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const config = await validateRepoConfig({
        token: token.trim(),
        owner: prefs.owner.trim(),
        repo: prefs.repo.trim() || DEFAULT_REPO,
        branch: prefs.branch.trim() || DEFAULT_BRANCH,
      })
      await saveRepoConfig(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Stormpad</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Conecte um repositório privado do GitHub. Use um token fine-grained com permissão
            <strong> Contents: Read and write</strong> apenas nesse repositório.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Se o repositório ainda não existir, ele é criado como privado — para isso o token precisa de
            <strong> All repositories</strong> e <strong>Administration: Read and write</strong>.
          </p>
        </div>

        <label className="block space-y-1 text-sm">
          <span>Token do GitHub</span>
          <input
            className={inputClass}
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>

        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
          className="group rounded-md border border-zinc-800"
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm text-zinc-300 select-none [&::-webkit-details-marker]:hidden">
            <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
            Customizações avançadas
          </summary>
          <div className="space-y-4 border-t border-zinc-800 p-3">
            <label className="block space-y-1 text-sm">
              <span>Dono (usuário ou organização)</span>
              <input
                className={inputClass}
                placeholder="Usuário do token"
                value={prefs.owner}
                onChange={(e) => updatePref('owner', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Repositório</span>
              <input
                className={inputClass}
                placeholder={DEFAULT_REPO}
                value={prefs.repo}
                onChange={(e) => updatePref('repo', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Branch</span>
              <input
                className={inputClass}
                placeholder={DEFAULT_BRANCH}
                value={prefs.branch}
                onChange={(e) => updatePref('branch', e.target.value)}
              />
            </label>
          </div>
        </details>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
        >
          {submitting ? 'Validando…' : 'Conectar'}
        </button>
      </form>
    </div>
  )
}
