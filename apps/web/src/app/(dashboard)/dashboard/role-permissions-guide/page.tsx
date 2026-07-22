'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  BookOpen, Shield, Eye, EyeOff, CheckCircle, Save, Users, ArrowRight,
  LayoutList, MousePointerClick, AlertTriangle, Lock,
} from 'lucide-react'

type Lang = 'both' | 'en' | 'si'

const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'both', label: 'English + සිංහල' },
  { key: 'en', label: 'English' },
  { key: 'si', label: 'සිංහල' },
]

function LevelBadge({ level }: { level: 'hide' | 'view' | 'edit' }) {
  const map = {
    hide: { Icon: EyeOff, label: 'Hide', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
    view: { Icon: Eye, label: 'View', className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30' },
    edit: { Icon: CheckCircle, label: 'Edit', className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' },
  } as const
  const { Icon, label, className } = map[level]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}

function BiText({ lang, en, si }: { lang: Lang; en: string; si: string }) {
  if (lang === 'en') return <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{en}</p>
  if (lang === 'si') return <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{si}</p>
  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{en}</p>
      <p className="text-sm leading-relaxed opacity-90" style={{ color: 'var(--text-muted)' }}>{si}</p>
    </div>
  )
}

function StepCard({
  n, titleEn, titleSi, lang, children,
}: {
  n: number
  titleEn: string
  titleSi: string
  lang: Lang
  children: React.ReactNode
}) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
          {n}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {lang === 'si' ? titleSi : titleEn}
          </h3>
          {lang === 'both' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{titleSi}</p>
          )}
        </div>
      </div>
      <div className="pl-11 space-y-2">{children}</div>
    </div>
  )
}

export default function RolePermissionsGuidePage() {
  const [lang, setLang] = useState<Lang>('both')

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="page-title flex items-center gap-2">
            <BookOpen size={22} className="text-violet-500" />
            Role Permission Matrix — Guide
          </h1>
          <p className="page-subtitle">
            {lang === 'si'
              ? 'Manager / Cashier / Technician ට මොන features දකින්නද, edit කරන්නද කියලා Owner විදිහට set කරන විදිහ'
              : 'How the Owner sets Hide / View / Edit access for Manager, Cashier, and Technician'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {LANG_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setLang(o.key)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                lang === o.key
                  ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                  : 'border-white/10 text-slate-500 hover:text-slate-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/role-permissions" className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
          <Shield size={13} />
          Open Role Permissions
          <ArrowRight size={12} />
        </Link>
        <Link href="/dashboard/staff?tab=permissions" className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
          <Users size={13} />
          Staff page → Matrix tab
        </Link>
      </div>

      {/* What it is */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <LayoutList size={15} className="text-violet-400" />
          {lang === 'si' ? 'මේක මොකද්ද?' : 'What is the Permission Matrix?'}
        </h2>
        <BiText
          lang={lang}
          en="It is a table of Features (rows) × Roles (columns). For each cell you choose Hide, View, or Edit. Saving applies to every staff member with that role. The Owner column is always full Edit and cannot be locked."
          si="Features (rows) × Roles (columns) table එකක්. සෑම cell එකකටම Hide / View / Edit තෝරන්න. Save කළාම ඒ role එකේ හැම staff කෙනෙකුටම apply වෙනවා. Owner column එක හැම වෙලේම Edit — lock කරන්න බෑ."
        />
      </div>

      {/* Levels */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {lang === 'si' ? 'මට්ටම් තුන (Levels)' : 'The three levels'}
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <LevelBadge level="hide" />
            <BiText
              lang={lang}
              en="Feature is removed from the sidebar and blocked in the app for that role. Staff cannot open that module."
              si="Sidebar එකෙන් feature එක ඉවත් වෙනවා. ඒ role එකට module එක open කරන්න බෑ."
            />
          </div>
          <div className="flex items-start gap-3">
            <LevelBadge level="view" />
            <BiText
              lang={lang}
              en="Staff can browse the page but cannot add, edit, or delete. A “View only” banner appears where needed."
              si="Page බලන්න පුළුවන් — add / edit / delete කරන්න බෑ. අවශ්‍ය තැන්වල View only banner එකක් පේනවා."
            />
          </div>
          <div className="flex items-start gap-3">
            <LevelBadge level="edit" />
            <BiText
              lang={lang}
              en="Full use — create, update, delete, and all actions for that module (subject to branch assignment)."
              si="සම්පූර්ණ ප්‍රවේශය — create / update / delete සහ ඒ module එකේ actions (branch assignment අනුව)."
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold px-1" style={{ color: 'var(--text-primary)' }}>
          {lang === 'si' ? 'පියවරෙන් පියවර (Owner)' : 'Step-by-step (Owner)'}
        </h2>

        <StepCard n={1} lang={lang} titleEn="Open the matrix" titleSi="Matrix එක open කරන්න">
          <BiText
            lang={lang}
            en="Sidebar → HR & Staff → Role Permissions. Or open Staff & Roles → Permission Matrix tab."
            si="Sidebar → HR & Staff → Role Permissions. නැත්නම් Staff & Roles → Permission Matrix tab."
          />
          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Lock size={12} />
            {lang === 'si' ? 'වෙනස් කරන්න පුළුවන් Owner / Platform Admin විතරයි.' : 'Only Owner (or Platform Admin) can change cells.'}
          </p>
        </StepCard>

        <StepCard n={2} lang={lang} titleEn="Click a cell to cycle access" titleSi="Cell එකක් click කරලා level වෙනස් කරන්න">
          <BiText
            lang={lang}
            en="Each click cycles: Hide → View → Edit → Hide. Skip the Owner column — it stays Edit."
            si="Click කරන හැම වතාවකම: Hide → View → Edit → Hide. Owner column skip කරන්න — ඒක Edit ම තියෙනවා."
          />
          <p className="text-xs flex items-center gap-1.5 text-violet-400">
            <MousePointerClick size={12} />
            {lang === 'si' ? 'උදා: Cashier ට Inventory Hide, POS Edit' : 'Example: Cashier → Inventory Hide, POS Edit'}
          </p>
        </StepCard>

        <StepCard n={3} lang={lang} titleEn="Save your changes" titleSi="Save කරන්න">
          <BiText
            lang={lang}
            en="Click Save at the top. Until you Save, an “Unsaved changes” bar stays visible. Reset defaults restores the factory matrix (still needs Save)."
            si="උඩින් Save click කරන්න. Save කරන්න කලින් Unsaved changes bar එක පේනවා. Reset defaults = factory settings (Save කරන්න ඕනේ)."
          />
          <p className="text-xs inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Save size={12} />
            {lang === 'si' ? 'Save එකට පස්සේ staff refresh / re-login කළාම නව access යොදවයි.' : 'After Save, staff see new access on next refresh or login.'}
          </p>
        </StepCard>

        <StepCard n={4} lang={lang} titleEn="Assign staff to a role" titleSi="Staff කෙනෙකුට role එකක් දෙන්න">
          <BiText
            lang={lang}
            en="Staff & Roles → Add Staff / Edit → pick Manager, Cashier, or Technician, and assign at least one branch. Their matrix row applies automatically."
            si="Staff & Roles → Add / Edit → Manager / Cashier / Technician තෝරන්න + අවමයෙන් branch එකක්. Matrix row එක auto apply වෙනවා."
          />
        </StepCard>
      </div>

      {/* Tips */}
      <div className="card p-5 space-y-3 border border-amber-500/20 bg-amber-500/5">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-200">
          <AlertTriangle size={15} />
          {lang === 'si' ? 'වැදගත් tips' : 'Important tips'}
        </h2>
        <ul className="space-y-2 text-sm list-disc pl-5" style={{ color: 'var(--text-secondary)' }}>
          {(lang === 'si'
            ? [
                'Product Cost = buying price / margin දකිනවාද කියන වෙනම row එකක්.',
                'Branches manage කිරීම Owner-focused — matrix එකෙන් Manager ට View දුන්නත් create branch Owner only වෙන්න පුළුවන්.',
                'Cashier ට POS Edit තියෙනවා නම් products list කියවන්න පුළුවන් — Inventory Hide වුණත් POS work වෙනවා.',
                'Hide කළාට පස්සේත් URL දන්නවා නම් page එකට යන්න හදන්න පුළුවන් — system එක redirect / 403 කරනවා.',
              ]
            : lang === 'en'
              ? [
                  'Product Cost is a separate row for seeing buying price and margins.',
                  'Creating branches stays Owner-focused even if Manager has Branches View.',
                  'If Cashier has POS Edit, they can still load products for selling even when Inventory is Hide.',
                  'Hidden modules are blocked in the UI and API — staff cannot use them by guessing the URL.',
                ]
              : [
                  'Product Cost = separate row for buying price / margins. · Product Cost = buying price / margin වෙනම row එකක්.',
                  'Branch create stays Owner-focused. · Branch create බොහෝ විට Owner only.',
                  'POS Edit still allows product reads for selling. · POS Edit තියෙනවා නම් sell කරන්න products කියවන්න පුළුවන්.',
                  'Hide is enforced in UI + API. · Hide = UI සහ API දෙකෙන්ම block.',
                ]
          ).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3 pb-4">
        <Link href="/dashboard/role-permissions" className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-2">
          <Shield size={14} />
          {lang === 'si' ? 'Matrix එකට යන්න' : 'Go to matrix'}
        </Link>
        <Link href="/dashboard/user-manual" className="btn-secondary text-sm px-4 py-2 inline-flex items-center gap-2">
          <BookOpen size={14} />
          {lang === 'si' ? 'Full User Manual' : 'Full User Manual'}
        </Link>
      </div>
    </div>
  )
}
