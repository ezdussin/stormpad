import { db, type SettingKey } from './db'

export const DEFAULT_REPO = 'stormpad-storage'
export const DEFAULT_BRANCH = 'main'

export interface RepoConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

export type RepoPrefs = Omit<RepoConfig, 'token'>

export async function getSetting(key: SettingKey): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function clearSetting(key: SettingKey): Promise<void> {
  await db.settings.delete(key)
}

export async function loadRepoConfig(): Promise<RepoConfig | null> {
  const [token, owner, repo, branch] = await db.settings.bulkGet([
    'github_token',
    'repo_owner',
    'repo_name',
    'branch',
  ])
  if (!token || !owner || !repo) return null
  return { token: token.value, owner: owner.value, repo: repo.value, branch: branch?.value || DEFAULT_BRANCH }
}

export async function loadRepoPrefs(): Promise<RepoPrefs> {
  const [owner, repo, branch] = await db.settings.bulkGet(['repo_owner', 'repo_name', 'branch'])
  return {
    owner: owner?.value ?? '',
    repo: repo?.value || DEFAULT_REPO,
    branch: branch?.value || DEFAULT_BRANCH,
  }
}

export async function saveRepoPrefs(prefs: Partial<RepoPrefs>): Promise<void> {
  const keys = { owner: 'repo_owner', repo: 'repo_name', branch: 'branch' } as const
  await db.settings.bulkPut(
    Object.entries(prefs).map(([field, value]) => ({ key: keys[field as keyof RepoPrefs], value })),
  )
}

export async function saveRepoConfig(config: RepoConfig): Promise<void> {
  await db.settings.bulkPut([
    { key: 'github_token', value: config.token },
    { key: 'repo_owner', value: config.owner },
    { key: 'repo_name', value: config.repo },
    { key: 'branch', value: config.branch },
  ])
}

// Repo preferences survive a disconnect so the setup form comes back pre-filled.
export async function clearRepoConfig(): Promise<void> {
  await db.settings.bulkDelete(['github_token', 'last_tree_sha'])
}
