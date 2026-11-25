import { Pin, PinOff } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { editMemory, setMemoryPinned } from '../../db/memories'
import { MarkdownBodyEditor } from '../MarkdownBodyEditor'
import { SideDrawer } from '../SideDrawer'

interface MemoryDetailDrawerProps {
  path: string
  onClose: () => void
}

export function MemoryDetailDrawer({ path, onClose }: MemoryDetailDrawerProps) {
  const memory = useLiveQuery(() => db.memories.get(path), [path])

  if (!memory || memory.syncStatus === 'deleted') {
    return (
      <SideDrawer title="Lembrança" onClose={onClose}>
        <p className="p-4 text-sm text-zinc-500">Esta lembrança não existe mais.</p>
      </SideDrawer>
    )
  }

  const created = new Date(memory.createdAt).toLocaleString()
  const edited = memory.editedAt ? new Date(memory.editedAt).toLocaleString() : null

  return (
    <SideDrawer
      title="Lembrança"
      subtitle={
        <span>
          {created}
          {edited ? ` · editado ${edited}` : ''}
        </span>
      }
      onClose={onClose}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <button
          type="button"
          onClick={() => void setMemoryPinned(memory.path, !memory.pinned)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            memory.pinned ? 'bg-sky-500/15 text-sky-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`}
        >
          {memory.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          {memory.pinned ? 'Desafixar' : 'Fixar'}
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4">
        <MarkdownBodyEditor
          documentKey={memory.path}
          markdown={memory.body}
          onChange={(body) => void editMemory(memory.path, body)}
          placeholder="Escreva em Markdown…"
        />
      </div>
    </SideDrawer>
  )
}
