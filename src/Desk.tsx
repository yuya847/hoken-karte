import { useMemo, useState } from 'react'
import { toHira } from './CommandPalette'
import { Icon } from './Icon'
import { PatientIcon, ageSex, birthLabel } from './PatientIcon'
import type { Action } from './store'
import type { Patient, QueueStatus } from './types'

export type View = 'schedule' | 'reception' | 'patients' | 'accounting' | 'settings'

export const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'schedule', label: '予定', icon: 'calendar_month' },
  { id: 'reception', label: '受付', icon: 'how_to_reg' },
  { id: 'patients', label: '患者', icon: 'groups' },
  { id: 'accounting', label: '会計', icon: 'payments' },
  { id: 'settings', label: '設定', icon: 'settings' },
]

export const STATUS_STYLE: Record<QueueStatus, string> = {
  待ち: 'bg-[#ffefc9] text-[#5c4300]',
  診察中: 'bg-primary-ctr text-on-primary-ctr',
  会計待ち: 'bg-rx-ctr text-rx',
  済: 'bg-surface-2 text-ink-2',
}

// 左の縦メニュー。診察中（カルテを開いている間）は細くして記載欄の幅を保つ
export function NavRail({ view, slim, onSelect }: { view: View | null; slim: boolean; onSelect: (v: View) => void }) {
  return (
    <aside aria-label="メニュー" className={`no-print flex shrink-0 flex-col items-center gap-1 pt-3 pb-3 ${slim ? 'w-14' : 'w-[76px]'}`}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white" title="保険診療カルテ">
        <Icon name="clinical_notes" fill size={24} />
      </span>
      {NAV.map((n) => {
        const on = view === n.id
        return (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            aria-current={on ? 'page' : undefined}
            className={`group flex w-full flex-col items-center gap-1 py-1 font-medium ${slim ? 'text-[10px]' : 'text-xs'} ${on ? 'text-on-secondary-ctr' : 'text-ink-2'}`}
          >
            <span
              className={`flex h-8 items-center justify-center rounded-full transition-colors touch:h-10 ${slim ? 'w-10' : 'w-14'} ${on ? 'bg-secondary-ctr' : 'group-hover:bg-ink/8'}`}
            >
              <Icon name={n.icon} fill={on} size={22} />
            </span>
            {n.label}
          </button>
        )
      })}
    </aside>
  )
}

const todaySummary = (p: Patient) => {
  const last = p.encounters.at(-1)
  const done = p.status === '会計待ち' || p.status === '済'
  return done && last ? `${last.kind}・処方${last.rx.length}剤・検査${last.tests.length}件${last.letters.length ? '・紹介状' : ''}` : '—'
}

// 予定は試作用の架空の時刻（9:00から15分おき）。予約機能はPhase 6
const slotOf = (i: number) => {
  const m = 9 * 60 + i * 15
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

type Col = { head: string; cell: (p: Patient, i: number) => React.ReactNode; className?: string }

// 行のどこを押してもカルテが開く表。行の中のボタンは行のクリックと分ける
function PatientTable({ patients, cols, onOpen, empty }: { patients: Patient[]; cols: Col[]; onOpen: (id: string) => void; empty: string }) {
  if (patients.length === 0) return <div className="rounded-2xl bg-surface-1 py-10 text-center text-ink-2">{empty}</div>
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-ink-2">
        <tr className="border-b border-outline-var">
          {cols.map((c, i) => (
            <th key={i} className={`px-3 py-2 font-medium ${c.className ?? ''}`}>
              {c.head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {patients.map((p, i) => (
          <tr
            key={p.id}
            onClick={() => onOpen(p.id)}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen(p.id)}
            tabIndex={0}
            title="カルテを開く"
            className="cursor-pointer border-b border-surface-2 outline-none hover:bg-surface-1 focus-visible:bg-primary-ctr/40 active:bg-surface-2"
          >
            {cols.map((c, j) => (
              <td key={j} className={`px-3 py-2.5 ${c.className ?? ''}`}>
                {c.cell(p, i)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const stop = (fn: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation()
  fn()
}

const C = {
  status: { head: '状態', cell: (p: Patient) => <span className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[p.status]}`}>{p.status}</span> },
  name: {
    head: '氏名',
    cell: (p: Patient) => (
      <div className="flex items-center gap-3">
        <PatientIcon patient={p} size={36} />
        <div>
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-ink-2">{p.kana}</div>
        </div>
      </div>
    ),
  },
  age: {
    head: '年齢・性別／生年月日',
    cell: (p: Patient) => (
      <>
        <div>{ageSex(p)}</div>
        <div className="text-xs text-ink-2">{birthLabel(p.birth)}生</div>
      </>
    ),
  },
  insurance: { head: '保険', cell: (p: Patient) => `${p.insurance} ${Math.round(p.burden * 10)}割`, className: 'max-md:hidden' },
  today: { head: '今日の内容', cell: (p: Patient) => <span className="text-ink-2">{todaySummary(p)}</span>, className: 'max-lg:hidden' },
  open: { head: '', cell: () => <Icon name="chevron_right" className="text-ink-2" />, className: 'w-10 text-right' },
} satisfies Record<string, Col>

function Page({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-1">
      <div className="card px-6 py-5">
        <h1 className="mb-4 text-[22px]">{title}</h1>
        {children}
        {note && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-2">
            <Icon name="info" size={16} />
            {note}
          </p>
        )}
      </div>
    </main>
  )
}

type DeskProps = { view: View; patients: Patient[]; dispatch: (a: Action) => void; onMetrics: () => void }

export function Desk({ view, patients, dispatch, onMetrics }: DeskProps) {
  const open = (id: string) => dispatch({ type: 'open', patientId: id })
  const [q, setQ] = useState('')
  const found = useMemo(() => {
    const t = toHira(q.trim().toLowerCase())
    return t ? patients.filter((p) => toHira(`${p.name} ${p.kana}`.toLowerCase()).replace(/\s/g, '').includes(t.replace(/\s/g, ''))) : patients
  }, [q, patients])

  if (view === 'schedule')
    return (
      <Page title="今日の予定" note="予約の時刻は試作用の架空のものです。予約・Web問診はPhase 6で実装します。">
        <PatientTable
          patients={patients}
          onOpen={open}
          empty="予定はありません"
          cols={[{ head: '時刻', cell: (_p, i) => <span className="font-medium tabular-nums">{slotOf(i)}</span>, className: 'w-20' }, C.name, C.age, C.status, C.open]}
        />
      </Page>
    )

  if (view === 'reception') {
    const list = patients.filter((p) => p.status === '待ち' || p.status === '診察中')
    return (
      <Page title={`受付（待ち ${list.length}人）`} note="行のどこを押してもカルテが開きます。">
        <PatientTable patients={list} onOpen={open} empty="待っている患者はいません" cols={[C.status, C.name, C.age, C.insurance, C.open]} />
      </Page>
    )
  }

  if (view === 'patients')
    return (
      <Page title="患者">
        <div className="relative mb-3 max-w-md">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="氏名・カナで検索（例：やまだ）"
            className="h-11 w-full rounded-full bg-surface-1 pr-4 pl-10 text-sm outline-none placeholder:text-ink-2/70 focus:bg-white focus:shadow-md"
          />
        </div>
        <PatientTable
          patients={found}
          onOpen={open}
          empty="該当する患者はいません"
          cols={[C.name, C.age, C.insurance, { head: '最終受診', cell: (p) => p.encounters.at(-1)?.date ?? '—', className: 'max-md:hidden' }, C.status, C.open]}
        />
      </Page>
    )

  if (view === 'accounting') {
    const list = patients.filter((p) => p.status === '会計待ち' || p.status === '済')
    return (
      <Page title="会計" note="点数・窓口負担の計算は算定エンジン（Phase 3）で実装します。行を押すとカルテを確認できます。">
        <PatientTable
          patients={list}
          onOpen={open}
          empty="会計待ちの患者はいません"
          cols={[
            C.status,
            C.name,
            C.today,
            {
              head: '',
              className: 'text-right',
              cell: (p) =>
                p.status === '会計待ち' ? (
                  <button onClick={stop(() => dispatch({ type: 'paid', patientId: p.id }))} className="btn btn-sm btn-tonal">
                    <Icon name="payments" size={18} />
                    会計済にする
                  </button>
                ) : (
                  <Icon name="chevron_right" className="text-ink-2" />
                ),
            },
          ]}
        />
      </Page>
    )
  }

  return (
    <Page title="設定">
      <div className="max-w-xl divide-y divide-surface-2 rounded-2xl bg-surface-1">
        <button onClick={onMetrics} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
          <Icon name="monitoring" className="text-primary" />
          <span className="flex-1">
            <span className="block">操作計測</span>
            <span className="block text-xs text-ink-2">患者ごとの確定までの時間と操作数</span>
          </span>
          <Icon name="chevron_right" className="text-ink-2" />
        </button>
        <button onClick={() => dispatch({ type: 'reset' })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
          <Icon name="restart_alt" className="text-error" />
          <span className="flex-1">
            <span className="block">架空データを初期状態に戻す</span>
            <span className="block text-xs text-ink-2">この端末に保存された記録・下書きを消して最初の5人に戻します</span>
          </span>
        </button>
      </div>
      <p className="mt-4 text-xs text-ink-2">職員・権限、医療機関情報、テンプレートなどの設定は今後追加します。</p>
    </Page>
  )
}
