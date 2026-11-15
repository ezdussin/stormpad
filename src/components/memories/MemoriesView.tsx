import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  SendHorizontal,
  Trash2,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { Memory, MemoryList } from '../../db/db'
import {
  addList,
  addMemory,
  deleteList,
  deleteMemory,
  editMemory,
  moveList,
  moveMemory,
  renameList,
  setMemoryPinned,
  useMemories,
  useMemoryLists,
} from '../../db/memories'
import { clearSetting, getSetting } from '../../db/settings'
import { copyText } from '../../lib/clipboard'
import type { MenuEntry } from '../ContextMenu'
import { ConfirmDialog } from '../Modal'
import { TextPromptModal } from '../TextPromptModal'
import { useContextMenu } from '../useContextMenu'
import { MEMORY_DRAG_TYPE, rowsFor } from './boardShared'
import { MemoryCard } from './MemoryCard'

/** Pinned first, then newest first. */
function byPinThenNewest(a: Memory, b: Memory): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return b.createdAt - a.createdAt
}

export function MemoriesView() {
  const memories = useMemories()
  const lists = useMemoryLists()
  const menu = useContextMenu()
  const deepLinkMemoryId = useLiveQuery(() => getSetting('deep_link_memory_id'), [])
  const [draft, setDraft] = useState('')
  const [draftListId, setDraftListId] = useState<string | null>(null)
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    if (!deepLinkMemoryId) return
    setHighlightId(deepLinkMemoryId)
    void clearSetting('deep_link_memory_id')
    const timer = window.setTimeout(() => setHighlightId(null), 2500)
    return () => window.clearTimeout(timer)
  }, [deepLinkMemoryId])
  const [dropListId, setDropListId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null)
  const [pendingListDelete, setPendingListDelete] = useState<MemoryList | null>(null)
  const [listPrompt, setListPrompt] = useState<{ list?: MemoryList } | null>(null)

  const targetListId = lists.some((list) => list.id === draftListId) ? draftListId! : lists[0].id

  const columns = useMemo(() => {
    const byList = new Map<string, Memory[]>(lists.map((list) => [list.id, []]))
    for (const memory of memories ?? []) {
      // Cards without a list, or whose list was deleted, land in the first list.
      const bucket = (memory.listId && byList.get(memory.listId)) || byList.get(lists[0].id)!
      bucket.push(memory)
    }
    for (const cards of byList.values()) cards.sort(byPinThenNewest)
    return byList
  }, [memories, lists])

  async function send() {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    await addMemory(body, targetListId)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  function handleDragOver(event: DragEvent, listId: string) {
    if (!event.dataTransfer.types.includes(MEMORY_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropListId(listId)
  }

  function handleDrop(event: DragEvent, listId: string) {
    event.preventDefault()
    setDropListId(null)
    setDraggingPath(null)
    const path = event.dataTransfer.getData(MEMORY_DRAG_TYPE)
    const memory = memories?.find((m) => m.path === path)
    const currentList = memory && (lists.some((l) => l.id === memory.listId) ? memory.listId : lists[0].id)
    if (memory && currentList !== listId) void moveMemory(path, listId)
  }

  function openCardMenu(event: MouseEvent, memory: Memory, listId: string) {
    const moveTargets: MenuEntry[] = lists
      .filter((list) => list.id !== listId)
      .map((list) => ({ label: `Mover para ${list.name}`, icon: FolderInput, onSelect: () => moveMemory(memory.path, list.id) }))
    menu.open(event, [
      { label: 'Copiar texto', icon: Copy, onSelect: () => copyText(memory.body) },
      { label: 'Editar', icon: Pencil, onSelect: () => setEditingPath(memory.path) },
      {
        label: memory.pinned ? 'Desafixar' : 'Fixar no topo',
        icon: memory.pinned ? PinOff : Pin,
        onSelect: () => setMemoryPinned(memory.path, !memory.pinned),
      },
      ...(moveTargets.length ? (['separator', ...moveTargets] as MenuEntry[]) : []),
      'separator',
      { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => setPendingDelete(memory) },
    ])
  }

  function openListMenu(event: MouseEvent, list: MemoryList, index: number) {
    menu.open(event, [
      { label: 'Renomear lista', icon: Pencil, onSelect: () => setListPrompt({ list }) },
      { label: 'Mover para a esquerda', icon: ArrowLeft, disabled: index === 0, onSelect: () => moveList(list.id, -1) },
      {
        label: 'Mover para a direita',
        icon: ArrowRight,
        disabled: index === lists.length - 1,
        onSelect: () => moveList(list.id, 1),
      },
      'separator',
      {
        label: 'Excluir lista',
        icon: Trash2,
        danger: true,
        disabled: lists.length === 1,
        onSelect: () => setPendingListDelete(list),
      },
    ])
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
        <h1 className="text-sm font-semibold">Lembranças</h1>
        <span className="text-xs text-zinc-500">{memories?.length ?? 0}</span>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {lists.map((list, index) => {
          const cards = columns.get(list.id) ?? []
          return (
            <section
              key={list.id}
              onDragOver={(e) => handleDragOver(e, list.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropListId(null)
              }}
              onDrop={(e) => handleDrop(e, list.id)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-zinc-900/40 transition-colors ${
                dropListId === list.id ? 'border-sky-500 bg-sky-500/5' : 'border-zinc-800'
              }`}
            >
              <div
                onContextMenu={(e) => openListMenu(e, list, index)}
                className="flex items-center gap-2 px-3 pt-2.5 pb-2"
              >
                <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{list.name}</h2>
                <span className="text-xs text-zinc-500">{cards.length}</span>
                <button
                  onClick={(e) => openListMenu(e, list, index)}
                  title="Opções da lista"
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
              <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {cards.map((memory) => (
                  <MemoryCard
                    key={memory.path}
                    memory={memory}
                    editing={editingPath === memory.path}
                    dragging={draggingPath === memory.path}
                    highlighted={highlightId === memory.id}
                    onMenu={(event) => openCardMenu(event, memory, list.id)}
                    onDragStart={() => setDraggingPath(memory.path)}
                    onDragEnd={() => {
                      setDraggingPath(null)
                      setDropListId(null)
                    }}
                    onSave={(body) => {
                      void editMemory(memory.path, body)
                      setEditingPath(null)
                    }}
                    onCancelEdit={() => setEditingPath(null)}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-600">
                    Arraste blocos para cá
                  </p>
                )}
              </div>
            </section>
          )
        })}

        <button
          onClick={() => setListPrompt({})}
          className="flex h-fit w-72 shrink-0 items-center gap-2 rounded-xl border border-dashed border-zinc-800 px-3 py-2.5 text-sm text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
        >
          <Plus size={16} /> Nova lista
        </button>
      </div>

      <div className="border-t border-zinc-800 p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            rows={rowsFor(draft)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Escreva uma lembrança…"
            title="Enter envia · Shift+Enter quebra linha"
            spellCheck={false}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <select
            value={targetListId}
            onChange={(e) => setDraftListId(e.target.value)}
            title="Lista de destino"
            className="max-w-40 rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm outline-none focus:border-sky-500"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void send()}
            disabled={!draft.trim()}
            title="Enviar (Enter)"
            className="rounded-xl bg-sky-600 p-2.5 hover:bg-sky-500 disabled:opacity-40"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>

      {menu.element}
      {listPrompt && (
        <TextPromptModal
          title={listPrompt.list ? 'Renomear lista' : 'Nova lista'}
          label="Nome"
          submitLabel={listPrompt.list ? 'Renomear' : 'Criar'}
          initialValue={listPrompt.list?.name}
          onSubmit={async (name) => {
            if (listPrompt.list) await renameList(listPrompt.list.id, name)
            else await addList(name)
          }}
          onClose={() => setListPrompt(null)}
        />
      )}
      {pendingListDelete && (
        <ConfirmDialog
          title="Excluir lista"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir a lista <strong className="text-zinc-100">{pendingListDelete.name}</strong>? Os blocos dela não são
              apagados: passam para a lista{' '}
              <strong className="text-zinc-100">{lists.find((list) => list.id !== pendingListDelete.id)?.name}</strong>.
            </p>
          }
          onConfirm={() => {
            void deleteList(pendingListDelete.id)
            setPendingListDelete(null)
          }}
          onCancel={() => setPendingListDelete(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Excluir lembrança"
          danger
          confirmLabel="Excluir"
          message={
            <p className="text-zinc-300">
              Excluir esta lembrança?{' '}
              {pendingDelete.sha === null
                ? 'Ela ainda não foi enviada ao GitHub e será perdida.'
                : 'Ela também será removida do GitHub no próximo sync.'}
            </p>
          }
          onConfirm={() => {
            void deleteMemory(pendingDelete.path)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
