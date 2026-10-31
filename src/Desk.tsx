import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { Icon } from './Icon'
import { BrandIcon } from './BrandMark'
import { saveIntegrations, useIntegrations, type Integrations as Cfg } from './integrations'
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

// 受付の状態の札と行の色（ファストカルテの受付一覧と同じ色：診察待ち＝青緑、診察中＝青、会計待ち＝金）
export const STATUS_STYLE: Record<QueueStatus, string> = {
  待ち: 'bg-[#12907f] text-white',
  診察中: 'bg-[#2f6fd0] text-white',
  会計待ち: 'bg-gold-dark text-white',
  済: 'bg-cream text-mist border border-line',
}
const ROW_TINT: Record<QueueStatus, string> = {
  待ち: 'bg-[#e6f6f2]',
  診察中: 'bg-[#e3ecfb]',
  会計待ち: 'bg-[#fff8e6]',
  済: 'bg-cream/50 text-mist',
}

// 左の縦メニュー（ファストカルテの NavRail と同じ形：白地・右に細い線・押している項目は金の面）。
// カルテを開いている間は細くして記載欄の幅を保つ。赤い数字は 受付＝待ち、会計＝会計待ち の人数
export function NavRail({ view, slim, patients, onSelect }: { view: View | null; slim: boolean; patients: Patient[]; onSelect: (v: View) => void }) {
  const badge: Partial<Record<View, number>> = {
    reception: patients.filter((p) => p.status === '待ち').length,
    accounting: patients.filter((p) => p.status === '会計待ち').length,
  }
  return (
    <aside aria-label="メニュー" className={`no-print flex shrink-0 flex-col items-center border-r border-line bg-ivory pt-2 pb-3 max-md:hidden ${slim ? 'w-14' : 'w-[76px]'}`}>
      <span className="mb-2 flex flex-col items-center gap-1" title="ファストカルテ 保険診療">
        <BrandIcon size={slim ? 30 : 34} />
        {!slim && <span className="text-[10px] leading-none font-semibold tracking-tight text-clinical">保険診療</span>}
      </span>
      <div className="flex w-full flex-col gap-0.5 px-1.5">
        {NAV.map((n) => {
          const on = view === n.id
          const count = badge[n.id] ?? 0
          return (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              aria-current={on ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg py-2 transition-colors ${slim ? 'text-[10px]' : 'text-[11px]'} ${
                on ? 'bg-gold-soft font-semibold text-ink' : 'text-mist hover:bg-cream hover:text-ink'
              }`}
            >
              <Icon name={n.icon} size={22} className={on ? 'ms-bold' : ''} />
              {n.label}
              {count > 0 && (
                <span className="absolute top-0.5 right-1 min-w-[1.125rem] rounded-full bg-red-600 px-1 text-center text-[10px] leading-[1.125rem] font-bold text-white">{count}</span>
              )}
            </button>
          )
        })}
      </div>
      <span className="flex-1" />
      {!slim && <span className="line-clamp-2 px-1 text-center text-[10px] text-mist">青木 医師（Dr）</span>}
    </aside>
  )
}

// 幅768未満は左の縦メニューの代わりに下のタブ（並びは縦メニューと同じ）
export function MobileTabBar({ view, onSelect }: { view: View | null; onSelect: (v: View) => void }) {
  return (
    <nav aria-label="メニュー" className="no-print flex shrink-0 border-t border-line bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV.map((n) => {
        const on = view === n.id
        return (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            aria-current={on ? 'page' : undefined}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? 'font-medium text-ink' : 'text-mist'}`}
          >
            <Icon name={n.icon} size={22} className={on ? 'ms-bold' : ''} />
            {n.label}
          </button>
        )
      })}
    </nav>
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

type SortKey = 'kana' | 'age' | 'last'
type Col = { head: string; cell: (p: Patient, i: number) => React.ReactNode; className?: string; sort?: SortKey }
type Sort = { key: SortKey; dir: 1 | -1; set: (k: SortKey) => void }

// 行のどこを押してもカルテが開く表。行の中のボタンは行のクリックと分ける。
// スマホは列を隠し、隠した内容は氏名の下に小さく出す。
// 表は横いっぱいに伸ばさない（列が端と端に離れると読みにくい。biyou-karte の患者一覧と同じ）
function PatientTable({ patients, cols, onOpen, empty, sort, tint }: { patients: Patient[]; cols: Col[]; onOpen: (id: string) => void; empty: string; sort?: Sort; tint?: boolean }) {
  // ファストカルテの受付と同じキー操作：↑↓（J/K）で行を選び、Enter（C）でカルテを開く。入力中・窓を開いている間は効かない
  const [sel, setSel] = useState(-1)
  const listRef = useRef(patients)
  listRef.current = patients
  const selRef = useRef(sel)
  selRef.current = sel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || document.querySelector('[aria-modal="true"]')) return
      const n = listRef.current.length
      if (!n) return
      const k = e.key
      if (k === 'ArrowDown' || k === 'j') setSel((i) => Math.min(n - 1, i + 1))
      else if (k === 'ArrowUp' || k === 'k') setSel((i) => Math.max(0, i - 1))
      else if ((k === 'Enter' || k === 'c') && selRef.current >= 0 && t === document.body) onOpen(listRef.current[selRef.current].id)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])

  if (patients.length === 0) return <div className="max-w-5xl rounded-lg border border-dashed border-line bg-ivory px-6 py-12 text-center text-mist">{empty}</div>
  return (
    <div className="max-w-5xl overflow-x-auto rounded-lg border border-line bg-ivory shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-cream text-left text-xs text-mist">
          <tr className="border-b border-line">
            {cols.map((c, i) => (
              <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${c.className ?? ''}`} aria-sort={sort && c.sort === sort.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {sort && c.sort ? (
                  <button onClick={() => sort.set(c.sort!)} className={`-mx-1 flex items-center gap-0.5 rounded px-1 hover:text-ink ${c.sort === sort.key ? 'text-ink' : ''}`}>
                    {c.head}
                    {c.sort === sort.key && <Icon name={sort.dir === 1 ? 'arrow_upward' : 'arrow_downward'} size={14} />}
                  </button>
                ) : (
                  c.head
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patients.map((p, i) => (
            <tr
              key={p.id}
              onClick={() => onOpen(p.id)}
              onMouseEnter={() => setSel(-1)}
              onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen(p.id)}
              tabIndex={0}
              title="カルテを開く"
              className={`cursor-pointer border-b border-line outline-none last:border-b-0 hover:brightness-[0.97] ${tint ? ROW_TINT[p.status] : 'hover:bg-cream/70'} ${
                sel === i ? 'bg-[#f3ead8]! outline-2 -outline-offset-2 outline-clinical' : ''
              }`}
            >
              {cols.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${c.className ?? ''}`}>
                  {c.cell(p, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const stop = (fn: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation()
  fn()
}

const STATUSES: QueueStatus[] = ['待ち', '診察中', '会計待ち', '済']

// 状態は行の中で直接変えられる（押してもカルテは開かない）
function StatusSelect({ p, dispatch }: { p: Patient; dispatch: (a: Action) => void }) {
  return (
    <select
      value={p.status}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => dispatch({ type: 'status', patientId: p.id, status: e.target.value as QueueStatus })}
      aria-label={`${p.name}の状態`}
      className={`h-7 cursor-pointer appearance-none rounded px-2 text-xs font-medium whitespace-nowrap outline-none touch:h-10 ${STATUS_STYLE[p.status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  )
}

const C = {
  name: {
    head: '氏名',
    sort: 'kana',
    cell: (p: Patient) => (
      <div className="flex items-center gap-3">
        <PatientIcon patient={p} size={30} />
        <div className="min-w-0">
          <div className="font-medium whitespace-nowrap">{p.name}</div>
          <div className="text-xs whitespace-nowrap text-ink-2">
            {p.kana}
            <span className="md:hidden">・{ageSex(p)}</span>
          </div>
        </div>
      </div>
    ),
  },
  age: {
    head: '年齢・性別／生年月日',
    sort: 'age',
    className: 'max-md:hidden',
    cell: (p: Patient) => (
      <>
        <div className="whitespace-nowrap">{ageSex(p)}</div>
        <div className="text-xs text-ink-2">{birthLabel(p.birth)}生</div>
      </>
    ),
  },
  insurance: { head: '保険', cell: (p: Patient) => `${p.insurance} ${Math.round(p.burden * 10)}割`, className: 'whitespace-nowrap max-md:hidden' },
  last: { head: '最終受診', sort: 'last', cell: (p: Patient) => <span className="tabular-nums">{p.encounters.at(-1)?.date ?? '—'}</span>, className: 'whitespace-nowrap max-md:hidden' },
  today: { head: '今日の内容', cell: (p: Patient) => <span className="text-ink-2">{todaySummary(p)}</span>, className: 'max-lg:hidden' },
  open: { head: '', cell: () => <Icon name="chevron_right" className="text-ink-2" />, className: 'w-10 text-right' },
} satisfies Record<string, Col>

// 見出しの右に検索などを置く（上部の共通検索バーは置かない）
function Page({ title, children, note, action }: { title: string; children: React.ReactNode; note?: string; action?: React.ReactNode }) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-8 max-md:px-4 max-md:pt-4">
      <div>
        <div className="mb-4 flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-base font-semibold whitespace-nowrap">{title}</h1>
          {action}
        </div>
        {children}
        {note && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-mist">
            <Icon name="info" size={16} />
            {note}
          </p>
        )}
      </div>
    </main>
  )
}

// 見出しの右に状態ごとの人数（ファストカルテの受付の右上と同じ）
function StatusCounts({ patients }: { patients: Patient[] }) {
  return (
    <span className="flex flex-wrap gap-1.5 text-xs">
      {STATUSES.map((st) => (
        <span key={st} className={`rounded px-2 py-1 font-medium ${STATUS_STYLE[st]}`}>
          {st} <span className="font-num">{patients.filter((p) => p.status === st).length}</span>
        </span>
      ))}
    </span>
  )
}

type DeskProps = { view: View; patients: Patient[]; dispatch: (a: Action) => void; onMetrics: () => void }

export function Desk({ view, patients, dispatch, onMetrics }: DeskProps) {
  const open = (id: string) => dispatch({ type: 'open', patientId: id })
  const status: Col = { head: '状態', cell: (p) => <StatusSelect p={p} dispatch={dispatch} /> }
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('kana')
  const [dir, setDir] = useState<1 | -1>(1)
  // 見出しを押すと並べ替え、同じ見出しをもう一度押すと逆順
  const sort: Sort = { key: sortKey, dir, set: (k) => (k === sortKey ? setDir((d) => (d === 1 ? -1 : 1)) : (setSortKey(k), setDir(1))) }
  const found = useMemo(() => {
    const t = toHira(q.trim().toLowerCase()).replace(/\s/g, '')
    const hit = t ? patients.filter((p) => toHira(`${p.name}${p.kana}`.toLowerCase()).replace(/\s/g, '').includes(t)) : patients
    const val = (p: Patient) => (sortKey === 'kana' ? p.kana : sortKey === 'age' ? p.birth : (p.encounters.at(-1)?.date ?? ''))
    // 年齢の昇順＝若い順なので生年月日は逆に比べる
    const sign = sortKey === 'age' ? -dir : dir
    return [...hit].sort((a, b) => val(a).localeCompare(val(b), 'ja') * sign)
  }, [q, patients, sortKey, dir])
  const byStatus = (order: QueueStatus[]) => (a: Patient, b: Patient) => order.indexOf(a.status) - order.indexOf(b.status)

  if (view === 'schedule')
    return (
      <Page title="今日の予定" note="予約の時刻は試作用の架空のものです。予約・Web問診はPhase 6で実装します。">
        <PatientTable
          patients={patients}
          onOpen={open}
          empty="予定はありません"
          cols={[{ head: '時刻', cell: (_p, i) => <span className="font-medium tabular-nums">{slotOf(i)}</span>, className: 'w-20' }, C.name, C.age, status, C.open]}
        />
      </Page>
    )

  if (view === 'reception') {
    // 診察中を上に。状態は行の札から直接変えられる
    const list = patients.filter((p) => p.status === '待ち' || p.status === '診察中').sort(byStatus(['診察中', '待ち']))
    return (
      <Page title="受付患者一覧" note="行のどこを押してもカルテが開きます。↑↓（J/K）で行を選び Enter で開けます。状態の札を押すと状態を変えられます。" action={<StatusCounts patients={patients} />}>
        <PatientTable tint patients={list} onOpen={open} empty="待っている患者はいません" cols={[status, C.name, C.age, C.insurance, C.open]} />
      </Page>
    )
  }

  if (view === 'patients')
    return (
      <Page
        title="患者"
        action={
          <div className="relative min-w-56 flex-1 md:max-w-sm">
            <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-mist" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名・カナで検索（例：やまだ）"
              className="h-9 w-full rounded-md border border-line bg-ivory pr-3 pl-9 text-sm outline-none placeholder:text-mist/70 focus:border-clinical touch:h-11"
            />
          </div>
        }
      >
        <PatientTable patients={found} onOpen={open} empty="該当する患者はいません" sort={sort} cols={[C.name, C.age, C.insurance, C.last, status, C.open]} />
      </Page>
    )

  if (view === 'accounting') {
    const list = patients.filter((p) => p.status === '会計待ち' || p.status === '済').sort(byStatus(['会計待ち', '済']))
    return (
      <Page title="会計" note="点数・窓口負担の計算は算定エンジン（Phase 3）で実装します。行を押すとカルテを確認できます。">
        <PatientTable
          patients={list}
          onOpen={open}
          empty="会計待ちの患者はいません"
          cols={[
            status,
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
      <div className="max-w-xl divide-y divide-surface-2 rounded-lg bg-surface-1">
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
      <Integrations />
      <p className="mt-4 text-xs text-ink-2">職員・権限、医療機関情報、テンプレートなどの設定は今後追加します。</p>
    </Page>
  )
}

const FIELDS: { key: keyof Cfg; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'pacsViewer',
    label: 'PACSビューアのURL',
    hint: '画像の「PACSで開く」で新しいタブに開きます。{patientId} {accession} {studyUid} は開くときに置き換えます',
    placeholder: 'https://pacs.example.local/viewer?StudyInstanceUIDs={studyUid}',
  },
  {
    key: 'advViewer',
    label: 'CT・MRI用ソフトの起動URL',
    hint: '3Dワークステーション等。CT・MRIの画像にだけボタンが出ます。独自のURLスキーム（例 ziostation://）も使えます',
    placeholder: 'workstation://open?accession={accession}',
  },
  { key: 'advLabel', label: 'CT・MRI用ソフトの表示名', hint: 'ボタンに出す名前', placeholder: '3Dビューア' },
  {
    key: 'orderTo',
    label: 'CT・MRIオーダーの送信先',
    hint: 'RIS・依頼先病院の名前。本番は HL7 / DICOM MWL で送ります（試作では送信しません）',
    placeholder: '〇〇病院 放射線科（RIS）',
  },
]

// 外部連携（PACS・CT/MRI用ソフト・画像オーダーの送信先）。この端末のブラウザにだけ保存する
function Integrations() {
  const cfg = useIntegrations()
  return (
    <section className="mt-6 max-w-xl">
      <h2 className="mb-2 flex items-center gap-2 text-base font-medium">
        <Icon name="hub" size={20} className="text-primary" />
        外部連携
      </h2>
      <div className="space-y-4 rounded-lg bg-surface-1 px-4 py-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="block text-sm">{f.label}</span>
            <input
              value={cfg[f.key]}
              onChange={(e) => saveIntegrations({ ...cfg, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              spellCheck={false}
              className="field mt-1 h-10 w-full px-3 text-sm"
            />
            <span className="mt-1 block text-xs text-ink-2">{f.hint}</span>
          </label>
        ))}
        <p className="text-xs text-ink-2">この端末のブラウザにだけ保存します。</p>
      </div>
    </section>
  )
}
