import { PanelRightOpen, Pin } from 'lucide-react'
import { type DragEvent, type MouseEvent } from 'react'
import type { Memory } from '../../db/db'
import { MEMORY_DRAG_TYPE } from './boardShared'

function dateLabel(timestamp: number): string {
  const date = new Date(timestamp)
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

interface MemoryCardProps {
  memory: Memory
  dragging: boolean
  highlighted?: boolean
  onOpen: () => void
  onMenu: (event: MouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
}

export function MemoryCard({
  memory,
  dragging,
  highlighted = false,
  onOpen,
  onMenu,
  onDragStart,
  onDragEnd,
}: MemoryCardProps) {
  function handleDragStart(event: DragEvent) {
    event.dataTransfer.setData(MEMORY_DRAG_TYPE, memory.path)
    event.dataTransfer.effectAllowed = 'move'
    onDragStart()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onMenu}
      className={`rounded-lg border p-2.5 text-sm shadow-sm shadow-black/30 transition-opacity ${
        memory.syncStatus === 'conflict'
          ? 'border-amber-500/60 bg-amber-950/40'
          : highlighted
            ? 'border-sky-500 bg-sky-950/40 ring-1 ring-sky-500/40'
            : 'border-zinc-800 bg-zinc-900'
      } cursor-grab active:cursor-grabbing ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 line-clamp-[12] break-words whitespace-pre-wrap">{memory.body}</p>
        <button
          type="button"
          title="Abrir"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <PanelRightOpen size={14} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
        {memory.pinned && <Pin size={11} className="text-sky-400" />}
        <span title={new Date(memory.createdAt).toLocaleString()}>{dateLabel(memory.createdAt)}</span>
        {memory.editedAt && <span title={new Date(memory.editedAt).toLocaleString()}>· editado</span>}
        {memory.syncStatus === 'dirty' && <span title="Ainda não enviada" className="ml-auto size-1.5 rounded-full bg-sky-400" />}
      </div>
    </div>
  )
}
