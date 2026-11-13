import { Eye, FileCode, FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Note } from '../db/db'
import { updateNoteContent } from '../db/notes'
import { copyText } from '../lib/clipboard'
import { splitFrontmatter } from '../lib/frontmatter'
import { CodeEditor } from './CodeEditor'
import type { MenuEntry } from './ContextMenu'
import { TOGGLE_MODE_SHORTCUT, type EditorMode } from './editorMode'
import { RichEditor } from './RichEditor'

const AUTOSAVE_DEBOUNCE_MS = 300

interface NoteEditorProps {
  note: Note
  mode: EditorMode
  onToggleMode: () => void
  menuEntries?: MenuEntry[]
}

export function NoteEditor({ note, mode, onToggleMode, menuEntries = [] }: NoteEditorProps) {
  const [value, setValue] = useState(note.content)
  const lastSaved = useRef(note.content)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const path = note.path

  useEffect(() => {
    if (note.content !== lastSaved.current && pending.current === null) {
      lastSaved.current = note.content
      setValue(note.content)
    }
  }, [note.content])

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      if (pending.current !== null) void updateNoteContent(path, pending.current)
    }
  }, [path])

  function flush() {
    timer.current = undefined
    if (pending.current === null) return
    lastSaved.current = pending.current
    void updateNoteContent(path, pending.current)
    pending.current = null
  }

  function handleChange(next: string) {
    setValue(next)
    pending.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
  }

  const { frontmatter, body } = splitFrontmatter(value)
  const leadingBlankLines = body.match(/^(\r?\n)*/)?.[0] ?? ''

  // The frontmatter is kept byte-for-byte; only the body goes through the rich editor's Markdown serializer.
  function handleBodyChange(markdown: string) {
    handleChange(`${frontmatter}${leadingBlankLines}${markdown.trimEnd()}\n`)
  }

  const entries: MenuEntry[] = [
    { label: 'Copiar nota inteira', icon: FileText, onSelect: () => copyText(value) },
    {
      label: mode === 'rich' ? 'Ver código Markdown' : 'Ver formatado',
      icon: mode === 'rich' ? FileCode : Eye,
      shortcut: TOGGLE_MODE_SHORTCUT,
      onSelect: onToggleMode,
    },
    ...(menuEntries.length ? (['separator', ...menuEntries] as MenuEntry[]) : []),
  ]

  if (mode === 'code') {
    return <CodeEditor value={value} onChange={handleChange} menuEntries={entries} />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 pt-6 pb-24">
        <RichEditor
          markdown={body.slice(leadingBlankLines.length)}
          onChange={handleBodyChange}
          menuEntries={entries}
        />
      </div>
    </div>
  )
}
