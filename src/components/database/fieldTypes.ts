import { AlignLeft, Calendar, CircleChevronDown, Hash, Link, SquareCheck, Tags, Type, type LucideIcon } from 'lucide-react'
import type { FieldType, OptionColor } from '../../db/databaseTypes'

export const FIELD_TYPES: Record<FieldType, { label: string; icon: LucideIcon }> = {
  title: { label: 'Título', icon: Type },
  text: { label: 'Texto', icon: AlignLeft },
  number: { label: 'Número', icon: Hash },
  select: { label: 'Seleção', icon: CircleChevronDown },
  multi_select: { label: 'Multisseleção', icon: Tags },
  date: { label: 'Data', icon: Calendar },
  checkbox: { label: 'Checkbox', icon: SquareCheck },
  url: { label: 'URL', icon: Link },
}

/** Every type except `title`, which exists exactly once per database. */
export const CREATABLE_FIELD_TYPES: FieldType[] = ['text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url']

export const OPTION_COLOR_CLASSES: Record<OptionColor, string> = {
  gray: 'bg-zinc-700/70 text-zinc-100',
  brown: 'bg-amber-900/70 text-amber-100',
  orange: 'bg-orange-800/70 text-orange-100',
  yellow: 'bg-yellow-700/60 text-yellow-50',
  green: 'bg-emerald-800/70 text-emerald-100',
  blue: 'bg-sky-800/70 text-sky-100',
  purple: 'bg-violet-800/70 text-violet-100',
  pink: 'bg-pink-800/70 text-pink-100',
  red: 'bg-red-800/70 text-red-100',
}

/** Solid swatches for the option color picker. */
export const OPTION_COLOR_DOTS: Record<OptionColor, string> = {
  gray: 'bg-zinc-500',
  brown: 'bg-amber-700',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  purple: 'bg-violet-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
}
