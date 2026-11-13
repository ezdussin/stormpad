import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { normalizeTags } from '../lib/tags'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  placeholder?: string
}

export function TagInput({ value, onChange, suggestions, placeholder = 'Adicionar…' }: TagInputProps) {
  const [text, setText] = useState('')
  const listId = useId()
  const taken = new Set(value.map((tag) => tag.toLowerCase()))

  function commit(raw: string) {
    const added = raw.split(',').filter((part) => part.trim())
    if (added.length) onChange(normalizeTags([...value, ...added]))
    setText('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(text)
    } else if (event.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 focus-within:border-sky-500">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded bg-zinc-800 py-0.5 pr-1 pl-2 text-xs text-zinc-200">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            title={`Remover ${tag}`}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(text)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
      <datalist id={listId}>
        {suggestions
          .filter((tag) => !taken.has(tag.toLowerCase()))
          .map((tag) => (
            <option key={tag} value={tag} />
          ))}
      </datalist>
    </div>
  )
}
