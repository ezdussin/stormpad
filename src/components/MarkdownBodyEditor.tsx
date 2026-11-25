import { useEffect, useRef, useState } from 'react'
import { RichEditor } from './RichEditor'

const AUTOSAVE_DEBOUNCE_MS = 300

interface MarkdownBodyEditorProps {
  /** Stable id for the document being edited; resets local state when it changes. */
  documentKey: string
  markdown: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
}

/** TipTap Markdown body with debounced persistence, matching the note editor. */
export function MarkdownBodyEditor({
  documentKey,
  markdown,
  onChange,
  placeholder = 'Escreva notas em Markdown…',
  className = '',
}: MarkdownBodyEditorProps) {
  const [value, setValue] = useState(markdown)
  const lastSaved = useRef(markdown)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    window.clearTimeout(timer.current)
    pending.current = null
    lastSaved.current = markdown
    setValue(markdown)
  }, [documentKey])

  useEffect(() => {
    if (markdown !== lastSaved.current && pending.current === null) {
      lastSaved.current = markdown
      setValue(markdown)
    }
  }, [markdown])

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      if (pending.current !== null) onChangeRef.current(pending.current)
    }
  }, [documentKey])

  function flush() {
    timer.current = undefined
    if (pending.current === null) return
    lastSaved.current = pending.current
    onChangeRef.current(pending.current)
    pending.current = null
  }

  function handleChange(next: string) {
    setValue(next)
    pending.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${className}`}>
      {!value.trim() && (
        <p className="pointer-events-none absolute px-1 pt-1 text-sm text-zinc-600">{placeholder}</p>
      )}
      <div className="relative min-h-[12rem] flex-1 px-1 pb-8">
        <RichEditor markdown={value} onChange={handleChange} menuEntries={[]} />
      </div>
    </div>
  )
}
