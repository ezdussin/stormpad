import { Pin } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { Memory } from '../../db/db'
import { MEMORY_DRAG_TYPE, rowsFor } from './boardShared'

function dateLabel(timestamp: number): string {
  const date = new Date(timestamp)
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function MemoryEditor({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  function save() {
    const body = value.trim()
    if (!body) return
    if (body === initial.trim()) onCancel()
    else onSave(body)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        rows={rowsFor(value)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
      />
      <div className="flex justify-end gap-2 text-xs">
        <button onClick={onCancel} className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!value.trim()}
          className="rounded-md bg-sky-600 px-2 py-1 font-medium hover:bg-sky-500 disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

interface MemoryCardProps {
  memory: Memory
  editing: boolean
  dragging: boolean
  highlighted?: boolean
  onMenu: (event: MouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
  onSave: (body: string) => void
  onCancelEdit: () => void
}

export function MemoryCard({
  memory,
  editing,
  dragging,
  highlighted = false,
  onMenu,
  onDragStart,
  onDragEnd,
  onSave,
  onCancelEdit,
}: MemoryCardProps) {
  function handleDragStart(event: DragEvent) {
    event.dataTransfer.setData(MEMORY_DRAG_TYPE, memory.path)
    event.dataTransfer.effectAllowed = 'move'
    onDragStart()
  }

  return (
    <div
      draggable={!editing}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={editing ? undefined : onMenu}
      className={`rounded-lg border p-2.5 text-sm shadow-sm shadow-black/30 transition-opacity ${
        memory.syncStatus === 'conflict'
          ? 'border-amber-500/60 bg-amber-950/40'
          : highlighted
            ? 'border-sky-500 bg-sky-950/40 ring-1 ring-sky-500/40'
            : 'border-zinc-800 bg-zinc-900'
      } ${editing ? '' : 'cursor-grab active:cursor-grabbing'} ${dragging ? 'opacity-40' : ''}`}
    >
      {editing ? (
        <MemoryEditor initial={memory.body} onSave={onSave} onCancel={onCancelEdit} />
      ) : (
        <p className="line-clamp-[12] break-words whitespace-pre-wrap">{memory.body}</p>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
        {memory.pinned && <Pin size={11} className="text-sky-400" />}
        <span title={new Date(memory.createdAt).toLocaleString()}>{dateLabel(memory.createdAt)}</span>
        {memory.editedAt && <span title={new Date(memory.editedAt).toLocaleString()}>· editado</span>}
        {memory.syncStatus === 'dirty' && <span title="Ainda não enviada" className="ml-auto size-1.5 rounded-full bg-sky-400" />}
      </div>
    </div>
  )
}
