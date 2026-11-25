import {
  Bookmark,
  BookOpen,
  Box,
  Briefcase,
  Calendar,
  CheckSquare,
  ClipboardList,
  Code2,
  Database,
  File,
  FileText,
  Flag,
  Folder,
  FolderKanban,
  Heart,
  Home,
  Inbox,
  Layers,
  Lightbulb,
  ListTodo,
  Map,
  Newspaper,
  NotebookPen,
  Package,
  Pin,
  Rocket,
  ScrollText,
  Settings,
  Sparkles,
  Star,
  StickyNote,
  Table2,
  Tag,
  Target,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export const APP_ICONS = {
  'file-text': FileText,
  file: File,
  'sticky-note': StickyNote,
  'notebook-pen': NotebookPen,
  'book-open': BookOpen,
  'scroll-text': ScrollText,
  newspaper: Newspaper,
  inbox: Inbox,
  folder: Folder,
  'folder-kanban': FolderKanban,
  bookmark: Bookmark,
  pin: Pin,
  star: Star,
  heart: Heart,
  flag: Flag,
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  rocket: Rocket,
  target: Target,
  home: Home,
  briefcase: Briefcase,
  users: Users,
  calendar: Calendar,
  'list-todo': ListTodo,
  'check-square': CheckSquare,
  'clipboard-list': ClipboardList,
  tag: Tag,
  layers: Layers,
  box: Box,
  package: Package,
  map: Map,
  wallet: Wallet,
  wrench: Wrench,
  settings: Settings,
  'code-2': Code2,
  'table-2': Table2,
  database: Database,
} as const

export type AppIconId = keyof typeof APP_ICONS

export const DEFAULT_NOTE_ICON: AppIconId = 'file-text'
export const DEFAULT_DATABASE_ICON: AppIconId = 'table-2'

export function isAppIconId(value: string | null | undefined): value is AppIconId {
  return typeof value === 'string' && value in APP_ICONS
}

export function resolveAppIcon(id: string | null | undefined, fallback: AppIconId): LucideIcon {
  return isAppIconId(id) ? APP_ICONS[id] : APP_ICONS[fallback]
}

export const APP_ICON_IDS = Object.keys(APP_ICONS) as AppIconId[]
