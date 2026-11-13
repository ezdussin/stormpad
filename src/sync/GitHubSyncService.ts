import { Octokit } from '@octokit/rest'
import type { Table } from 'dexie'
import { db, type TextFile } from '../db/db'
import { parseDatabaseRow, parseDatabaseSchema } from '../db/databases'
import { parseGalleryItem } from '../db/gallery'
import { BOARD_PATH, parseBoard, parseMemory } from '../db/memories'
import { setSetting, type RepoConfig } from '../db/settings'
import { base64ToBlob, base64ToUtf8, blobToBase64, utf8ToBase64 } from '../lib/base64'
import { parseNoteMeta } from '../lib/frontmatter'
import { mimeTypeOf } from '../lib/image'

export interface SyncResult {
  pushed: number
  pulled: number
  removed: number
  conflicts: number
}

type TreeEntry = { path?: string; sha?: string; type?: string }

/**
 * A folder of text files mirrored into one table. On a push conflict, `copy` keeps the remote
 * version beside the local one for a manual merge; `keepLocal` overwrites the remote on the next push.
 */
interface TextCollection {
  table: Table<TextFile, string>
  matches: (path: string) => boolean
  derive: (path: string, content: string) => object
  onConflict: 'copy' | 'keepLocal'
}

const textCollections: TextCollection[] = [
  {
    table: db.notes as unknown as Table<TextFile, string>,
    matches: (path) => path.startsWith('notes/') && path.endsWith('.md'),
    derive: parseNoteMeta,
    onConflict: 'copy',
  },
  {
    table: db.memories as unknown as Table<TextFile, string>,
    matches: (path) => path.startsWith('memories/') && path.endsWith('.md'),
    derive: parseMemory,
    onConflict: 'copy',
  },
  {
    table: db.memoryBoard as unknown as Table<TextFile, string>,
    matches: (path) => path === BOARD_PATH,
    derive: parseBoard,
    onConflict: 'keepLocal',
  },
  {
    table: db.gallery as unknown as Table<TextFile, string>,
    matches: (path) => path.startsWith('gallery/') && path.endsWith('.json'),
    derive: parseGalleryItem,
    onConflict: 'keepLocal',
  },
  {
    table: db.databases as unknown as Table<TextFile, string>,
    matches: (path) => /^databases\/[^/]+\/schema\.json$/.test(path),
    derive: parseDatabaseSchema,
    onConflict: 'keepLocal',
  },
  {
    table: db.databaseRows as unknown as Table<TextFile, string>,
    matches: (path) => /^databases\/[^/]+\/rows\/[^/]+\.json$/.test(path),
    derive: parseDatabaseRow,
    onConflict: 'keepLocal',
  },
]

// GitHub API responses carry `Cache-Control: max-age=60`. Served from the browser cache, the tree fetched
// right after a push still lists files that were just deleted, and the pull would bring them back.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token, request: { fetch: noStoreFetch } })
}

const MAX_CHANGES_PER_COMMIT = 1000
const MAX_COMMIT_ATTEMPTS = 3
const MAX_PATHS_IN_COMMIT_MESSAGE = 30

type PendingText = { collection: TextCollection; file: TextFile }

type TreeChange = { path: string; mode: '100644'; type: 'blob'; content?: string; sha?: null }

/** The branch moved (another device pushed) between reading the head and updating it. */
class StaleHeadError extends Error {}

function commitMessage(upserts: PendingText[], deletes: PendingText[]): string {
  const summary = [
    upserts.length && `${upserts.length} updated`,
    deletes.length && `${deletes.length} deleted`,
  ].filter(Boolean)
  const lines = [
    ...upserts.map(({ file }) => `+ ${file.path}`),
    ...deletes.map(({ file }) => `- ${file.path}`),
  ]
  const shown = lines.slice(0, MAX_PATHS_IN_COMMIT_MESSAGE)
  if (lines.length > shown.length) shown.push(`… and ${lines.length - shown.length} more`)
  return `Sync: ${summary.join(', ')}\n\n${shown.join('\n')}`
}

function isAssetPath(path: string): boolean {
  return path.startsWith('gallery/') && !path.endsWith('.json')
}

function httpStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : undefined
}

function conflictPath(path: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.replace(/(\.[^./]+)$/, `.conflict-${stamp}$1`)
}

function githubError(error: unknown): Error {
  const status = httpStatus(error)
  if (status === 401) return new Error('Token inválido ou expirado.')
  if (status === 404) return new Error('Repositório não encontrado ou sem acesso para este token.')
  return new Error('Não foi possível conectar ao GitHub.')
}

async function createPrivateRepo(octokit: Octokit, owner: string, login: string, name: string): Promise<void> {
  // Left empty on purpose: the sync service seeds it and creates the configured branch.
  const params = { name, private: true, auto_init: false }
  try {
    if (owner.toLowerCase() === login.toLowerCase()) {
      await octokit.repos.createForAuthenticatedUser(params)
    } else {
      await octokit.repos.createInOrg({ org: owner, ...params })
    }
  } catch (error) {
    const status = httpStatus(error)
    if (status === 422) throw new Error(`O repositório ${owner}/${name} já existe, mas este token não tem acesso a ele.`)
    if (status === 403 || status === 404) {
      throw new Error(
        `O repositório ${owner}/${name} não existe e o token não tem permissão para criá-lo. ` +
          'Crie-o como privado no GitHub e selecione-o no token, ou gere um token com ' +
          '"All repositories" e "Administration: Read and write".',
      )
    }
    throw githubError(error)
  }
}

// An empty owner falls back to the user that owns the token; a missing repo is created as private.
export async function validateRepoConfig(config: RepoConfig): Promise<RepoConfig> {
  const octokit = createOctokit(config.token)
  let login: string
  try {
    login = (await octokit.users.getAuthenticated()).data.login
  } catch (error) {
    throw githubError(error)
  }

  const owner = config.owner || login
  let canPush = true
  try {
    const { data } = await octokit.repos.get({ owner, repo: config.repo })
    canPush = data.permissions?.push ?? true
  } catch (error) {
    if (httpStatus(error) !== 404) throw githubError(error)
    await createPrivateRepo(octokit, owner, login, config.repo)
  }
  if (!canPush) throw new Error('O token não tem permissão de escrita neste repositório.')
  return { ...config, owner }
}

export class GitHubSyncService {
  private readonly octokit: Octokit
  private readonly config: RepoConfig
  private branchReady = false
  private readonly downloads = new Map<string, Promise<Blob | null>>()
  /** path → sha of files this device deleted remotely, until a fetched tree confirms they're gone. */
  private readonly deletedRemotely = new Map<string, string>()

  constructor(config: RepoConfig) {
    this.config = config
    this.octokit = createOctokit(config.token)
  }

  /** True when the tree entry is a file this device already deleted but GitHub still reports (replication lag). */
  private isStaleDeletion(path: string, sha: string): boolean {
    return this.deletedRemotely.get(path) === sha
  }

  private forgetConfirmedDeletions(entries: TreeEntry[]): void {
    const remote = new Map(entries.map((entry) => [entry.path, entry.sha]))
    for (const [path, sha] of this.deletedRemotely) {
      if (remote.get(path) !== sha) this.deletedRemotely.delete(path)
    }
  }

  private get repoParams() {
    return { owner: this.config.owner, repo: this.config.repo }
  }

  async sync(): Promise<SyncResult> {
    if (!this.branchReady) {
      await this.ensureBranch()
      this.branchReady = true
    }
    const result: SyncResult = { pushed: 0, pulled: 0, removed: 0, conflicts: 0 }

    // Images go first so their metadata never reaches other devices before the file exists.
    result.pushed += await this.pushAssets()
    const { pushed, conflicts } = await this.pushTextFiles()
    result.pushed += pushed
    result.conflicts += conflicts

    const tree = await this.fetchTree()
    if (tree) {
      this.forgetConfirmedDeletions(tree.entries)
      for (const collection of textCollections) {
        const { pulled, removed } = await this.pullText(collection, tree.entries)
        result.pulled += pulled
        result.removed += removed
      }
      result.removed += await this.pullAssets(tree.entries)
      await setSetting('last_tree_sha', tree.sha)
    }
    return result
  }

  /** Returns the image bytes, downloading and caching them on first use. */
  async loadAsset(path: string): Promise<Blob | null> {
    const cached = await db.blobs.get(path)
    if (cached) return cached.blob

    let download = this.downloads.get(path)
    if (!download) {
      download = this.downloadAsset(path).finally(() => this.downloads.delete(path))
      this.downloads.set(path, download)
    }
    return download
  }

  private async downloadAsset(path: string): Promise<Blob | null> {
    const asset = await db.assets.get(path)
    if (!asset?.sha) return null
    const { data } = await this.octokit.git.getBlob({ ...this.repoParams, file_sha: asset.sha })
    const blob = base64ToBlob(data.content, mimeTypeOf(path))
    await db.blobs.put({ path, blob })
    return blob
  }

  private async getBranchSha(branch: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.git.getRef({ ...this.repoParams, ref: `heads/${branch}` })
      return data.object.sha
    } catch (error) {
      const status = httpStatus(error)
      // 409 = empty repository
      if (status === 404 || status === 409) return null
      throw error
    }
  }

  private async ensureBranch(): Promise<void> {
    const { branch } = this.config
    if (await this.getBranchSha(branch)) return

    const { data: repo } = await this.octokit.repos.get(this.repoParams)
    let baseSha = await this.getBranchSha(repo.default_branch)
    if (!baseSha) {
      // The Git data API rejects empty repositories, so the first commit must go through the contents API.
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        ...this.repoParams,
        path: 'README.md',
        message: 'Initialize Stormpad storage',
        content: utf8ToBase64('# Stormpad storage\n'),
      })
      baseSha = data.commit.sha ?? null
      if (!baseSha || repo.default_branch === branch) return
    }

    await this.octokit.git.createRef({ ...this.repoParams, ref: `refs/heads/${branch}`, sha: baseSha })
  }

  private async collectPendingText(): Promise<PendingText[]> {
    const pending: PendingText[] = []
    for (const collection of textCollections) {
      const files = await collection.table.where('syncStatus').anyOf('dirty', 'deleted').toArray()
      pending.push(...files.map((file) => ({ collection, file })))
    }
    return pending
  }

  /**
   * Sends every pending text file as one commit per batch through the Git data API. One request per file
   * (the contents API) would turn a CSV import into hundreds of commits and trip GitHub's secondary rate limits.
   */
  private async pushTextFiles(): Promise<{ pushed: number; conflicts: number }> {
    const total = { pushed: 0, conflicts: 0 }
    for (let attempt = 1; ; attempt++) {
      try {
        // Re-collected on every attempt: a failed attempt may already have resolved some conflicts locally.
        const pending = await this.collectPendingText()
        for (let i = 0; i < pending.length; i += MAX_CHANGES_PER_COMMIT) {
          const { pushed, conflicts } = await this.commitTextBatch(pending.slice(i, i + MAX_CHANGES_PER_COMMIT))
          total.pushed += pushed
          total.conflicts += conflicts
        }
        return total
      } catch (error) {
        if (!(error instanceof StaleHeadError) || attempt >= MAX_COMMIT_ATTEMPTS) throw error
      }
    }
  }

  private async commitTextBatch(batch: PendingText[]): Promise<{ pushed: number; conflicts: number }> {
    const { branch } = this.config
    const head = await this.getBranchSha(branch)
    if (!head) throw new Error(`A branch ${branch} não existe no repositório.`)
    const { data: headCommit } = await this.octokit.git.getCommit({ ...this.repoParams, commit_sha: head })
    const remote = await this.fetchTreeShas(headCommit.tree.sha)

    const changes: TreeChange[] = []
    const upserts: PendingText[] = []
    const deletes: PendingText[] = []
    let conflicts = 0

    // A remote sha different from the one this file was based on means another device changed it meanwhile.
    for (const item of batch) {
      const { collection, file } = item
      const remoteSha = remote.get(file.path) ?? null
      if (file.syncStatus === 'deleted') {
        if (remoteSha === null) {
          await collection.table.delete(file.path)
        } else if (remoteSha !== file.sha) {
          await this.resolveConflict(collection, file)
          conflicts++
        } else {
          changes.push({ path: file.path, mode: '100644', type: 'blob', sha: null })
          deletes.push(item)
        }
      } else if (remoteSha !== null && remoteSha !== file.sha) {
        await this.resolveConflict(collection, file)
        conflicts++
      } else {
        changes.push({ path: file.path, mode: '100644', type: 'blob', content: file.content })
        upserts.push(item)
      }
    }
    if (changes.length === 0) return { pushed: 0, conflicts }

    const { data: tree } = await this.octokit.git.createTree({ ...this.repoParams, base_tree: headCommit.tree.sha, tree: changes })
    const { data: commit } = await this.octokit.git.createCommit({
      ...this.repoParams,
      message: commitMessage(upserts, deletes),
      tree: tree.sha,
      parents: [head],
    })
    try {
      await this.octokit.git.updateRef({ ...this.repoParams, ref: `heads/${branch}`, sha: commit.sha })
    } catch (error) {
      if (httpStatus(error) === 422) throw new StaleHeadError()
      throw error
    }

    const committed = await this.fetchTreeShas(tree.sha)
    for (const { collection: { table }, file } of upserts) {
      const sha = committed.get(file.path) ?? null
      await db.transaction('rw', table, async () => {
        const current = await table.get(file.path)
        if (!current) return
        const editedWhilePushing = current.updatedAt !== file.updatedAt
        await table.update(file.path, editedWhilePushing ? { sha } : { sha, syncStatus: 'synced' })
      })
    }
    for (const { collection: { table }, file } of deletes) {
      this.deletedRemotely.set(file.path, remote.get(file.path)!)
      await db.transaction('rw', table, async () => {
        const current = await table.get(file.path)
        if (current?.syncStatus === 'deleted') await table.delete(file.path)
      })
    }
    return { pushed: upserts.length + deletes.length, conflicts }
  }

  private async fetchTreeShas(treeSha: string): Promise<Map<string, string>> {
    const { data } = await this.octokit.git.getTree({ ...this.repoParams, tree_sha: treeSha, recursive: 'true' })
    const shas = new Map<string, string>()
    for (const entry of data.tree) {
      if (entry.type === 'blob' && entry.path && entry.sha) shas.set(entry.path, entry.sha)
    }
    return shas
  }

  private async deleteRemote(path: string, sha: string): Promise<void> {
    try {
      await this.octokit.repos.deleteFile({
        ...this.repoParams,
        branch: this.config.branch,
        path,
        message: `Delete ${path}`,
        sha,
      })
    } catch (error) {
      if (httpStatus(error) !== 404) throw error
    }
    this.deletedRemotely.set(path, sha)
  }

  private async fetchRemoteFile(path: string): Promise<{ content: string; sha: string } | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        ...this.repoParams,
        path,
        ref: this.config.branch,
      })
      if (Array.isArray(data) || data.type !== 'file') return null
      return { content: base64ToUtf8(data.content), sha: data.sha }
    } catch (error) {
      if (httpStatus(error) === 404) return null
      throw error
    }
  }

  // With `copy`, local edits stay in the original file and the remote version is kept beside it
  // as `<name>.conflict-<timestamp>.<ext>` for the user to merge by hand.
  private async resolveConflict({ table, derive, onConflict }: TextCollection, file: TextFile): Promise<void> {
    const remote = await this.fetchRemoteFile(file.path)

    if (file.syncStatus === 'deleted') {
      if (remote) {
        await table.put({
          path: file.path,
          content: remote.content,
          sha: remote.sha,
          updatedAt: Date.now(),
          syncStatus: 'synced',
          ...derive(file.path, remote.content),
        })
      } else {
        await table.delete(file.path)
      }
      return
    }

    if (!remote) {
      await table.update(file.path, { sha: null })
      return
    }

    if (onConflict === 'keepLocal') {
      await table.update(file.path, { sha: remote.sha })
      return
    }

    const copyPath = conflictPath(file.path)
    await db.transaction('rw', table, async () => {
      await table.add({
        path: copyPath,
        content: remote.content,
        sha: null,
        updatedAt: Date.now(),
        syncStatus: 'conflict',
        ...derive(copyPath, remote.content),
      })
      await table.update(file.path, { sha: remote.sha })
    })
  }

  private async pullText(
    { table, matches, derive }: TextCollection,
    entries: TreeEntry[],
  ): Promise<{ pulled: number; removed: number }> {
    const remote = new Map<string, string>()
    for (const entry of entries) {
      if (entry.type === 'blob' && entry.path && entry.sha && matches(entry.path)) {
        if (!this.isStaleDeletion(entry.path, entry.sha)) remote.set(entry.path, entry.sha)
      }
    }

    const locals = new Map((await table.toArray()).map((file) => [file.path, file]))
    let pulled = 0
    let removed = 0

    for (const [path, sha] of remote) {
      const local = locals.get(path)
      if (local && (local.sha === sha || local.syncStatus !== 'synced')) continue

      const content = await this.fetchBlob(sha)
      const applied = await db.transaction('rw', table, async () => {
        const current = await table.get(path)
        if (current && current.syncStatus !== 'synced') return false
        await table.put({
          path,
          content,
          sha,
          updatedAt: Date.now(),
          syncStatus: 'synced',
          ...derive(path, content),
        })
        return true
      })
      if (applied) pulled++
    }

    for (const local of locals.values()) {
      if (local.syncStatus !== 'synced' || local.sha === null || remote.has(local.path)) continue
      if (!matches(local.path)) continue
      await table.delete(local.path)
      removed++
    }

    return { pulled, removed }
  }

  private async pushAssets(): Promise<number> {
    const pending = await db.assets.where('syncStatus').anyOf('dirty', 'deleted').toArray()
    let pushed = 0

    for (const asset of pending) {
      if (asset.syncStatus === 'deleted') {
        if (asset.sha) await this.deleteRemote(asset.path, asset.sha)
        await db.assets.delete(asset.path)
        pushed++
        continue
      }

      const stored = await db.blobs.get(asset.path)
      if (!stored) continue
      try {
        const { data } = await this.octokit.repos.createOrUpdateFileContents({
          ...this.repoParams,
          branch: this.config.branch,
          path: asset.path,
          message: `Upload ${asset.path}`,
          content: await blobToBase64(stored.blob),
          ...(asset.sha ? { sha: asset.sha } : {}),
        })
        await db.assets.update(asset.path, { sha: data.content?.sha ?? null, syncStatus: 'synced' })
        pushed++
      } catch (error) {
        const status = httpStatus(error)
        if (status !== 409 && !(status === 422 && asset.sha === null)) throw error
        // Images are never edited, so a conflict means the same upload already landed: adopt the remote sha.
        const remote = await this.fetchRemoteSha(asset.path)
        await db.assets.update(asset.path, { sha: remote })
      }
    }

    return pushed
  }

  private async fetchRemoteSha(path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.repos.getContent({ ...this.repoParams, path, ref: this.config.branch })
      return Array.isArray(data) ? null : data.sha
    } catch (error) {
      if (httpStatus(error) === 404) return null
      throw error
    }
  }

  private async pullAssets(entries: TreeEntry[]): Promise<number> {
    const remote = new Map<string, string>()
    for (const entry of entries) {
      if (entry.type === 'blob' && entry.path && entry.sha && isAssetPath(entry.path)) {
        if (!this.isStaleDeletion(entry.path, entry.sha)) remote.set(entry.path, entry.sha)
      }
    }

    const locals = new Map((await db.assets.toArray()).map((asset) => [asset.path, asset]))
    let removed = 0

    await db.transaction('rw', [db.assets, db.blobs], async () => {
      for (const [path, sha] of remote) {
        const local = locals.get(path)
        if (!local) {
          await db.assets.add({ path, sha, syncStatus: 'synced' })
        } else if (local.syncStatus === 'synced' && local.sha !== sha) {
          await db.assets.update(path, { sha })
          await db.blobs.delete(path)
        }
      }

      for (const local of locals.values()) {
        if (local.syncStatus !== 'synced' || local.sha === null || remote.has(local.path)) continue
        await db.assets.delete(local.path)
        await db.blobs.delete(local.path)
        removed++
      }
    })

    return removed
  }

  private async fetchTree() {
    try {
      const { data } = await this.octokit.git.getTree({
        ...this.repoParams,
        tree_sha: this.config.branch,
        recursive: 'true',
      })
      return { sha: data.sha, entries: data.tree as TreeEntry[] }
    } catch (error) {
      const status = httpStatus(error)
      // 409 = empty repository, 404 = branch doesn't exist yet
      if (status === 409 || status === 404) return null
      throw error
    }
  }

  private async fetchBlob(sha: string): Promise<string> {
    const { data } = await this.octokit.git.getBlob({ ...this.repoParams, file_sha: sha })
    return base64ToUtf8(data.content)
  }
}
