import { ClipboardPaste, Copy, Scissors, TextSelect } from 'lucide-react'
import { useRef, type MouseEvent } from 'react'
import { canReadClipboard, copyText, readText } from '../lib/clipboard'
import type { MenuEntry } from './ContextMenu'
import { useContextMenu } from './useContextMenu'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  menuEntries: MenuEntry[]
}

export function CodeEditor({ value, onChange, menuEntries }: CodeEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const menu = useContextMenu()

  // execCommand keeps the edit on the native undo stack; setRangeText is the fallback where it's unsupported.
  function replaceSelection(text: string) {
    const el = textarea.current
    if (!el) return
    el.focus()
    const handled = text ? document.execCommand('insertText', false, text) : document.execCommand('delete')
    if (!handled) {
      el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end')
      onChange(el.value)
    }
  }

  function openMenu(event: MouseEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget
    const selection = value.slice(el.selectionStart, el.selectionEnd)
    menu.open(event, [
      {
        label: 'Recortar',
        icon: Scissors,
        shortcut: 'Ctrl+X',
        disabled: !selection,
        onSelect: async () => {
          await copyText(selection)
          replaceSelection('')
        },
      },
      { label: 'Copiar', icon: Copy, shortcut: 'Ctrl+C', disabled: !selection, onSelect: () => copyText(selection) },
      {
        label: 'Colar',
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
        disabled: !canReadClipboard(),
        onSelect: async () => replaceSelection(await readText()),
      },
      {
        label: 'Selecionar tudo',
        icon: TextSelect,
        shortcut: 'Ctrl+A',
        onSelect: () => {
          el.focus()
          el.select()
        },
      },
      'separator',
      ...menuEntries,
    ])
  }

  return (
    <>
      <textarea
        ref={textarea}
        className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onContextMenu={openMenu}
      />
      {menu.element}
    </>
  )
}
