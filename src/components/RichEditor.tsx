import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ClipboardPaste, Copy, ExternalLink, Link, Scissors, TextSelect } from 'lucide-react'
import { useEffect, useRef, type MouseEvent } from 'react'
import { canReadClipboard, copyText, readText } from '../lib/clipboard'
import { collapseBlankLines } from '../lib/markdown'
import { absoluteUrl, openExternal } from '../lib/openExternal'
import type { MenuEntry } from './ContextMenu'
import { useContextMenu } from './useContextMenu'

// Every node a note may contain needs an extension here, otherwise it is dropped on the first edit.
// Link clicks are handled in `handleClick` (opening in the system browser on desktop), not by TipTap.
const extensions = [
  StarterKit.configure({ underline: false, link: { openOnClick: false } }),
  Image,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit,
  Markdown,
]

interface RichEditorProps {
  markdown: string
  onChange: (markdown: string) => void
  menuEntries: MenuEntry[]
}

export function RichEditor({ markdown, onChange, menuEntries }: RichEditorProps) {
  const menu = useContextMenu()
  const lastMarkdown = useRef(markdown)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions,
    content: markdown,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'tiptap-content flex-1 outline-none' } },
    onUpdate: ({ editor }) => {
      lastMarkdown.current = collapseBlankLines(editor.getMarkdown())
      onChangeRef.current(lastMarkdown.current)
    },
  })

  useEffect(() => {
    if (markdown.trim() === lastMarkdown.current.trim()) return
    lastMarkdown.current = markdown
    editor.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false })
  }, [editor, markdown])

  function linkAt(event: MouseEvent): string | null {
    return (event.target as HTMLElement).closest('a[href]')?.getAttribute('href') ?? null
  }

  function handleClick(event: MouseEvent) {
    const href = linkAt(event)
    // Dragging a selection across a link shouldn't open it.
    if (!href || event.button !== 0 || !window.getSelection()?.isCollapsed) return
    event.preventDefault()
    openExternal(href)
  }

  function openMenu(event: MouseEvent) {
    const { from, to, empty } = editor.state.selection
    const selection = editor.state.doc.textBetween(from, to, '\n')
    const href = linkAt(event)
    const linkEntries: MenuEntry[] = href
      ? [
          { label: 'Abrir link', icon: ExternalLink, onSelect: () => openExternal(href) },
          { label: 'Copiar link', icon: Link, onSelect: () => copyText(absoluteUrl(href)) },
          'separator',
        ]
      : []
    menu.open(event, [
      ...linkEntries,
      {
        label: 'Recortar',
        icon: Scissors,
        shortcut: 'Ctrl+X',
        disabled: empty,
        onSelect: async () => {
          await copyText(selection)
          editor.chain().focus().deleteSelection().run()
        },
      },
      { label: 'Copiar', icon: Copy, shortcut: 'Ctrl+C', disabled: empty, onSelect: () => copyText(selection) },
      {
        label: 'Colar',
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
        disabled: !canReadClipboard(),
        onSelect: async () => {
          const text = await readText()
          editor.chain().focus().insertContent(text, { contentType: 'markdown' }).run()
        },
      },
      {
        label: 'Selecionar tudo',
        icon: TextSelect,
        shortcut: 'Ctrl+A',
        onSelect: () => void editor.chain().focus().selectAll().run(),
      },
      'separator',
      ...menuEntries,
    ])
  }

  return (
    <>
      <EditorContent editor={editor} onClick={handleClick} onContextMenu={openMenu} className="flex flex-1 flex-col" />
      {menu.element}
    </>
  )
}
