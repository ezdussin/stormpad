import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ClipboardPaste, Copy, Scissors, TextSelect } from 'lucide-react'
import { useEffect, useRef, type MouseEvent } from 'react'
import { canReadClipboard, copyText, readText } from '../lib/clipboard'
import { collapseBlankLines } from '../lib/markdown'
import type { MenuEntry } from './ContextMenu'
import { useContextMenu } from './useContextMenu'

// Every node a note may contain needs an extension here, otherwise it is dropped on the first edit.
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

  function openMenu(event: MouseEvent) {
    const { from, to, empty } = editor.state.selection
    const selection = editor.state.doc.textBetween(from, to, '\n')
    menu.open(event, [
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
      <EditorContent editor={editor} onContextMenu={openMenu} className="flex flex-1 flex-col" />
      {menu.element}
    </>
  )
}
