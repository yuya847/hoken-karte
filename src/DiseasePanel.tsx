import { useEffect, useMemo, useRef, useState } from 'react'
import { DISEASES, today } from './data'
import { Icon } from './Icon'
import { diseaseLabel, planDiseases, planIsEmpty, type DxPlan } from './orders'
import { OrderSearch, type SearchItem } from './OrderSearch'
import type { Action } from './store'
import type { Disease, Draft, Patient } from './types'

const DX_ITEMS: SearchItem[] = DISEASES.map((x) => ({ id: x.name, label: x.name, keys: `${x.kana} ${x.alias}`, icon: 'diagnosis', iconClass: 'text-dx' }))

const nextOption = (options: string[], cur: string) => options[(options.indexOf(cur) + 1) % options.length]

// 記載欄の下に出す1行だけの表示。確定時に病名がどう変わるかを知らせ、候補はタップで切り替えられる
export function DxStrip({ patient, draft, dispatch }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void }) {
  const plan = useMemo(() => planDiseases(patient, draft), [patient, draft])
  if (planIsEmpty(plan)) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
      <Icon name="auto_awesome" size={16} className="text-dx" />
      <span>確定時に病名を自動更新</span>
      <PlanChips plan={plan} dispatch={dispatch} />
    </div>
  )
}

function PlanChips({ plan, dispatch }: { plan: DxPlan; dispatch: (a: Action) => void }) {
  return (
    <>
      {plan.add.map((a) => (
        <button
          key={a.orderId}
          disabled={a.options.length < 2}
          onClick={() => dispatch({ type: 'dxChoice', orderId: a.orderId, name: nextOption(a.options, a.name) })}
          title={a.options.length > 1 ? `${a.order}から。タップで候補を切り替え（${a.options.join('／')}）` : `${a.order}から`}
          className="flex h-7 items-center gap-0.5 rounded-lg bg-dx-ctr px-2 text-dx disabled:cursor-default"
        >
          <Icon name="add" size={14} />
          {diseaseLabel(a)}
          {a.options.length > 1 && <Icon name="swap_horiz" size={14} className="opacity-60" />}
        </button>
      ))}
      {plan.confirm.map((c) => (
        <span key={c.id} title={`${c.order}の処方のため`} className="flex h-7 items-center rounded-lg bg-dx-ctr px-2 text-dx">
          {c.name} 疑い→確定
        </span>
      ))}
      {plan.close.map((c) => (
        <span key={c.id} title={c.reason} className="flex h-7 items-center rounded-lg bg-surface-1 px-2">
          {c.label}→{c.status}
        </span>
      ))}
    </>
  )
}

function Row({ d, dispatch }: { d: Disease; dispatch: (a: Action) => void }) {
  const ended = d.status !== '継続'
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${ended ? 'bg-surface-1 text-ink-2' : 'bg-dx-ctr/60'}`}>
      <button
        onClick={() => dispatch({ type: 'updateDisease', id: d.id, patch: { main: !d.main } })}
        className={`icon-btn icon-btn-sm ${d.main ? 'text-primary' : 'text-outline'}`}
        title={d.main ? '主病名' : '主病名にする'}
        disabled={ended}
      >
        <Icon name="star" fill={d.main} size={20} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{diseaseLabel(d)}</span>
        {d.auto && <span className="block truncate text-[11px] text-ink-2">自動：{d.auto}</span>}
      </span>
      {!ended && (
        <button onClick={() => dispatch({ type: 'updateDisease', id: d.id, patch: { suspected: !d.suspected } })} className={`chip h-7 px-2 text-xs ${d.suspected ? 'chip-on' : ''}`}>
          疑い
        </button>
      )}
      <span className="shrink-0 text-xs tabular-nums text-ink-2">
        {d.start}〜{d.end ?? ''}
      </span>
      <select
        value={d.status}
        onChange={(e) => {
          const status = e.target.value as Disease['status']
          dispatch({ type: 'updateDisease', id: d.id, patch: { status, end: status === '継続' ? undefined : today(), main: status === '継続' ? d.main : false } })
        }}
        className="field field-sm w-auto rounded-lg text-xs"
      >
        <option>継続</option>
        <option>治癒</option>
        <option>中止</option>
      </select>
    </div>
  )
}

// 右端の「病名」アイコンで開く。普段は触らず、確認と手直しのときだけ使う
export function DiseasePanel({ patient, draft, dispatch }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void }) {
  const [suspected, setSuspected] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const plan = useMemo(() => planDiseases(patient, draft), [patient, draft])
  const active = patient.diseases.filter((d) => d.status === '継続')
  const ended = patient.diseases.filter((d) => d.status !== '継続')

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pt-5 pb-3">
        <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="icon-btn" title="記載に戻る（Esc）">
          <Icon name="arrow_back" />
        </button>
        <h2 className="flex-1 text-[22px]">病名</h2>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-5">
        <p className="flex items-start gap-1.5 text-xs text-ink-2">
          <Icon name="info" size={16} />
          病名は処方・検査から確定時に自動で付き、使われなくなった疑い病名・急性疾患は自動で転帰します。ここは確認と手直し用です。
        </p>

        <div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <OrderSearch items={DX_ITEMS} inputRef={ref} placeholder="病名を検索して追加（例：こうけつ、dm）" onPick={(name) => dispatch({ type: 'addDisease', name, suspected })} />
            </div>
            <button onClick={() => setSuspected((v) => !v)} className={`chip h-10 ${suspected ? 'chip-on' : ''}`}>
              {suspected && <Icon name="check" size={16} />}
              疑いで追加
            </button>
          </div>
        </div>

        {!planIsEmpty(plan) && (
          <section>
            <div className="label mb-1.5 flex items-center gap-1">
              <Icon name="auto_awesome" size={16} className="text-dx" />
              今回の確定で自動更新
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <PlanChips plan={plan} dispatch={dispatch} />
            </div>
          </section>
        )}

        <section>
          <div className="label mb-1.5">継続中（{active.length}）</div>
          <div className="space-y-1">
            {active.map((d) => (
              <Row key={d.id} d={d} dispatch={dispatch} />
            ))}
            {active.length === 0 && <div className="text-sm text-ink-2">継続中の病名なし</div>}
          </div>
        </section>

        {ended.length > 0 && (
          <details>
            <summary className="label cursor-pointer">転帰済み（{ended.length}）</summary>
            <div className="mt-1.5 space-y-1">
              {ended.map((d) => (
                <Row key={d.id} d={d} dispatch={dispatch} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
