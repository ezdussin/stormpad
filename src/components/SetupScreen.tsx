import { ChevronRight, CircleHelp } from 'lucide-react'
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
import { Modal } from './Modal'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500'

function SetupHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como conectar o Stormpad" onClose={onClose} size="lg">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 text-zinc-300">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-100">Como funciona</h3>
          <p>
            O Stormpad guarda suas notas localmente e sincroniza com um repositório privado do GitHub.
            Use um token fine-grained com permissão <strong className="text-zinc-100">Contents: Read and write</strong>{' '}
            apenas nesse repositório.
          </p>
          <p>
            Você pode criar o repositório privado manualmente no GitHub e só liberar Contents: Read and write nele.
            Se preferir, deixe o Stormpad criar: quando o repositório ainda não existir, ele é criado como privado —
            para isso o token precisa de <strong className="text-zinc-100">All repositories</strong> e{' '}
            <strong className="text-zinc-100">Administration: Read and write</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-100">Passo a passo do token</h3>
          <ol className="list-decimal space-y-2.5 pl-4">
            <li>
              Abra{' '}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
              >
                github.com/settings/personal-access-tokens/new
              </a>{' '}
              (Settings → Developer settings → Personal access tokens → Fine-grained tokens).
            </li>
            <li>Defina um nome (ex.: Stormpad) e uma data de expiração.</li>
            <li>
              Em <strong className="text-zinc-100">Resource owner</strong>, escolha sua conta (ou a
              organização dona do repositório).
            </li>
            <li>
              Em <strong className="text-zinc-100">Repository access</strong>:
              <ul className="mt-1.5 list-disc space-y-1.5 pl-4">
                <li>
                  <strong className="text-zinc-100">Only select repositories</strong> — recomendado se
                  você criar o repo manualmente (privado, vazio ou já com arquivos). Selecione-o e, em
                  Permissions → Repository permissions, defina{' '}
                  <strong className="text-zinc-100">Contents: Read and write</strong>.
                </li>
                <li>
                  <strong className="text-zinc-100">All repositories</strong> — só necessário se o
                  Stormpad for criar o repo por você: além de Contents: Read and write, defina{' '}
                  <strong className="text-zinc-100">Administration: Read and write</strong>.
                </li>
              </ul>
            </li>
            <li>
              Gere o token, copie-o e cole no campo <strong className="text-zinc-100">Token do GitHub</strong>{' '}
              desta tela. O padrão do Stormpad é o repositório{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">{DEFAULT_REPO}</code> na
              branch <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">{DEFAULT_BRANCH}</code>.
            </li>
          </ol>
        </section>

        <p className="text-xs text-zinc-500">
          O token fica só neste dispositivo. Não compartilhe nem faça commit dele.
        </p>
      </div>
    </Modal>
  )
}

export function SetupScreen() {
  const [token, setToken] = useState('')
  const [prefs, setPrefs] = useState<RepoPrefs>({ owner: '', repo: DEFAULT_REPO, branch: DEFAULT_BRANCH })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
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
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-zinc-950 p-6 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.08),transparent_40%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm space-y-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm"
      >
        <div className="space-y-4 text-center">
          <img
            src="/favicon.svg"
            alt=""
            width={72}
            height={72}
            className="mx-auto size-[72px] rounded-[18px] shadow-lg shadow-black/40 ring-1 ring-white/10"
          />
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Stormpad</h1>
            <p className="text-sm text-zinc-400">Notas locais, sincronizadas no seu GitHub privado.</p>
          </div>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="flex items-center gap-1.5 text-zinc-300">
            Token do GitHub
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              title="Como obter e configurar o token"
              aria-label="Como obter e configurar o token"
              className="rounded-full p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <CircleHelp size={16} />
            </button>
          </span>
          <input
            className={inputClass}
            type="password"
            autoComplete="off"
            required
            placeholder="github_pat_…"
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
          className="w-full rounded-md bg-sky-600 px-3 py-2.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
        >
          {submitting ? 'Validando…' : 'Conectar'}
        </button>
      </form>

      {helpOpen && <SetupHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
