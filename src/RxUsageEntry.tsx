import { useEffect, useRef, useState } from 'react'
import { DRUGS } from './data'
import { EXT_TIMINGS, PRN_TIMINGS, TIMINGS, isBlank, isExternal, parseUsage, perDose } from './rxFormat'
import type { RxItem } from './types'

// 処方の表の行で、1回量 → 1日の回数 → いつ → 日数（外用は総量）をキーボードだけで選ぶ。
// 決まった値は入れておかない（薬を入れた直後は空）。薄く出ている値はその薬のいつもの量で、Enter だけで採れる。
//   1回量・日数：数字を打って Enter（空のまま Enter で薄い値）
//   1日の回数：1〜4 のキー（0 か T で頓用）。←→ で選んで Enter でも可
//   いつ：番号のキー（1 朝食後、2 夕食後 …）。←→ と Enter でも可
// Backspace（空のとき）で前の欄へ、Esc でやめる
type Step = 'per' | 'times' | 'timing' | 'n'
const STEPS: Step[] = ['per', 'times', 'timing', 'n']
const TIMES_CHOICES: (number | null)[] = [1, 2, 3, 4, null]

const num = (n: number) => String(Math.round(n * 100) / 100)

export function RxUsageEntry({ group, onCommit, onCancel }: { group: RxItem[]; onCommit: (patches: { id: string; patch: Partial<RxItem> }[]) => void; onCancel: () => void }) {
  const head = group[0]
  const ext = isExternal(head)
  const blank = isBlank(head)
  const drug = DRUGS.find((d) => d.id === head.drugId)
  // その薬のいつもの量（薄く出す既定値）
  const base = drug ? { ...head, ...drug, id: head.id } : head
  const bu = parseUsage(base.usage)
  const def = { per: num(perDose(base)), times: bu.times, timing: bu.timing, n: String(ext ? base.dose : base.days) }
  const cu = parseUsage(head.usage)

  const [per, setPer] = useState(blank ? '' : num(perDose(head)))
  const [times, setTimes] = useState<number | null | undefined>(blank ? undefined : cu.times)
  const [timing, setTiming] = useState(blank ? '' : cu.timing)
  const [n, setN] = useState(blank ? '' : String(ext ? head.dose : head.days))
  const [step, setStep] = useState<Step>('per')
  const [hi, setHi] = useState(0)
  const refs = useRef<Record<Step, HTMLElement | null>>({ per: null, times: null, timing: null, n: null })

  useEffect(() => refs.current[step]?.focus(), [step])

  const curTimes = times === undefined ? def.times : times
  const timingChoices = ext ? EXT_TIMINGS : curTimes === null ? PRN_TIMINGS : (TIMINGS[curTimes] ?? [])
  const timesChoices = ext ? TIMES_CHOICES.filter((x) => x !== null) : TIMES_CHOICES

  const go = (s: Step) => {
    setStep(s)
    if (s === 'times') setHi(Math.max(0, timesChoices.indexOf(curTimes)))
    if (s === 'timing') setHi(Math.max(0, timingChoices.indexOf(timing || def.timing)))
  }
  const next = (from: Step) => (from === 'n' ? commit() : go(STEPS[STEPS.indexOf(from) + 1]))
  const prev = (from: Step) => from !== 'per' && go(STEPS[STEPS.indexOf(from) - 1])

  const commit = (over?: { n?: string }) => {
    const p = Number(per || def.per) || 0
    const t = times === undefined ? def.times : times
    const tm = timing || (timingChoices.includes(def.timing) ? def.timing : timingChoices[0])
    const nn = Number(over?.n ?? (n || def.n)) || 0
    if (!p || !tm || !nn) return
    const usage = t ? `1日${t}回${tm}` : tm
    onCommit(
      group.map((r) => {
        const pr = r.id === head.id ? p : perDose(r)
        if (ext) return { id: r.id, patch: { usage, perUse: pr, dose: nn } }
        return { id: r.id, patch: { usage, dose: t ? pr * t : pr, days: nn } }
      }),
    )
  }

  const common = (s: Step) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[s] = el
    },
    onFocus: () => step !== s && go(s),
  })

  // 数字を打つ欄（1回量・日数）
  const numKeys = (s: 'per' | 'n', v: string) => (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      if (s === 'n') commit()
      else next(s)
    } else if (e.key === 'Backspace' && v === '') {
      e.preventDefault()
      prev(s)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
    }
  }

  // 選ぶ欄（1日の回数・いつ）。番号のキーで選んで次へ
  const pickKeys = (s: 'times' | 'timing') => (e: React.KeyboardEvent) => {
    const list: (number | null | string)[] = s === 'times' ? timesChoices : timingChoices
    const choose = (i: number) => {
      e.preventDefault()
      if (s === 'times') {
        const t = list[i] as number | null
        setTimes(t)
        if (t !== curTimes) setTiming('')
      } else setTiming(list[i] as string)
      next(s)
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((hi + 1) % list.length)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((hi - 1 + list.length) % list.length)
    } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) choose(hi)
    else if (s === 'times' && /^[1-4]$/.test(e.key)) choose(list.indexOf(Number(e.key)))
    else if (s === 'times' && !ext && (e.key === '0' || e.key.toLowerCase() === 't')) choose(list.indexOf(null))
    else if (s === 'timing' && /^[1-9]$/.test(e.key) && Number(e.key) <= list.length) choose(Number(e.key) - 1)
    else if (e.key === 'Backspace') {
      e.preventDefault()
      prev(s)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      prev(s)
    }
  }

  const box = (on: boolean) => `rounded-md px-1.5 py-1 transition-colors ${on ? 'bg-white ring-2 ring-primary' : 'hover:bg-white/70'}`
  const field = 'w-12 bg-transparent text-right font-num outline-none placeholder:text-ink-2/40'
  const chip = (on: boolean, sel: boolean) =>
    `inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs whitespace-nowrap ${
      on ? 'border-primary bg-primary text-white' : sel ? 'border-primary text-primary' : 'border-line bg-white text-ink-2'
    }`
  const timesLabel = (t: number | null) => (t === null ? '頓用' : `${t}回`)

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 py-1 text-[0.8125rem]" onPointerDown={(e) => e.stopPropagation()}>
      <label className={box(step === 'per')}>
        1回
        <input
          {...common('per')}
          value={per}
          onChange={(e) => setPer(e.target.value.replace(/[^\d.]/g, ''))}
          onKeyDown={numKeys('per', per)}
          placeholder={def.per}
          inputMode="decimal"
          aria-label={`${head.name} 1回量`}
          className={field}
        />
        {head.unit}
      </label>

      <span className={box(step === 'times')}>
        <span
          {...common('times')}
          tabIndex={0}
          role="listbox"
          aria-label={`${head.name} 1日の回数（1〜4のキー${ext ? '' : '、0で頓用'}）`}
          onKeyDown={pickKeys('times')}
          className="inline-flex items-center gap-1 outline-none"
        >
          <span className="text-ink-2">1日</span>
          {step === 'times' ? (
            timesChoices.map((t, i) => (
              <button
                key={String(t)}
                tabIndex={-1}
                onClick={() => {
                  setTimes(t)
                  if (t !== curTimes) setTiming('')
                  next('times')
                }}
                className={chip(i === hi, t === curTimes && times !== undefined)}
              >
                <span className="font-num text-[0.625rem] opacity-70">{t ?? 0}</span>
                {timesLabel(t)}
              </button>
            ))
          ) : (
            <span className={times === undefined ? 'text-ink-2/50' : 'font-medium'}>{timesLabel(curTimes)}</span>
          )}
        </span>
      </span>

      <span className={box(step === 'timing')}>
        <span {...common('timing')} tabIndex={0} role="listbox" aria-label={`${head.name} いつ（番号のキー）`} onKeyDown={pickKeys('timing')} className="inline-flex flex-wrap items-center gap-1 outline-none">
          {step === 'timing' ? (
            timingChoices.map((t, i) => (
              <button
                key={t}
                tabIndex={-1}
                onClick={() => {
                  setTiming(t)
                  next('timing')
                }}
                className={chip(i === hi, t === timing)}
              >
                <span className="font-num text-[0.625rem] opacity-70">{i + 1}</span>
                {t}
              </button>
            ))
          ) : (
            <span className={timing ? 'font-medium' : 'text-ink-2/50'}>{timing || (timingChoices.includes(def.timing) ? def.timing : timingChoices[0])}</span>
          )}
        </span>
      </span>

      <label className={box(step === 'n')}>
        {ext && '総量'}
        <input
          {...common('n')}
          value={n}
          onChange={(e) => setN(e.target.value.replace(/\D/g, ''))}
          onKeyDown={numKeys('n', n)}
          placeholder={def.n}
          inputMode="numeric"
          aria-label={`${head.name} ${ext ? '総量' : curTimes === null ? '回数' : '日数'}`}
          className={field}
        />
        {ext ? head.unit : curTimes === null ? '回分' : '日分'}
      </label>
      <span className="text-[0.6875rem] text-ink-2 max-lg:hidden">{step === 'times' ? `1〜4のキー${ext ? '' : '・0で頓用'}` : step === 'timing' ? '番号のキーで選ぶ' : 'Enterで次へ（空なら薄い値）'}</span>
    </div>
  )
}
