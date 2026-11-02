import { labItem } from './labData'
import { parseUsage } from './rxFormat'
import type { Disease, Encounter, LabValue, Patient, RxItem, Vitals } from './types'

// カルテから文書・計画書・会計に引く値。どの画面も同じ取り方をするためにここにまとめる

export const byDateDesc = (list: Encounter[]) => [...list].sort((a, b) => b.date.localeCompare(a.date))

export const activeDiseases = (p: Patient): Disease[] => p.diseases.filter((d) => d.status === '継続')
export const mainDisease = (p: Patient) => activeDiseases(p).find((d) => d.main) ?? activeDiseases(p)[0]
export const hasDisease = (p: Patient, re: RegExp) => activeDiseases(p).some((d) => !d.suspected && re.test(d.name))

// 今飲んでいる薬（最後に処方した日の処方）
export const currentRx = (p: Patient): RxItem[] => byDateDesc(p.encounters).find((e) => e.rx.length > 0)?.rx ?? []

// 直近のバイタル（項目ごとに一番新しい値）
export const latestVitals = (p: Patient): Vitals & { date?: string } => {
  const out: Vitals & { date?: string } = {}
  for (const e of byDateDesc(p.encounters)) {
    for (const [k, v] of Object.entries(e.vitals) as [keyof Vitals, number][]) if (out[k] === undefined && v !== undefined) out[k] = v
    if (!out.date && Object.keys(e.vitals).length) out.date = e.date
  }
  return out
}

// 検査値の一番新しいもの（日付つき）。series は古い順
export const latestLab = (p: Patient, code: string): (LabValue & { date: string }) | undefined => {
  const r = [...(p.labs ?? [])].sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.values.some((v) => v.code === code))
  const v = r?.values.find((x) => x.code === code)
  return r && v ? { ...v, date: r.date } : undefined
}
export const labSeries = (p: Patient, code: string) =>
  [...(p.labs ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((r) => r.values.filter((v) => v.code === code).map((v) => ({ date: r.date, value: v.value, flag: v.flag })))

export const labText = (p: Patient, code: string) => {
  const v = latestLab(p, code)
  const it = labItem(code)
  return v ? `${v.value}${it?.unit && it.unit !== '' ? ` ${it.unit}` : ''}（${v.date.slice(5).replace('-', '/')}）` : ''
}

// 処方が切れる日（最後の処方日＋内服の最大日数）。頓用・外用は数えない
export const rxRunsOut = (p: Patient) => {
  const e = byDateDesc(p.encounters).find((x) => x.rx.length > 0)
  if (!e) return undefined
  const days = Math.max(0, ...e.rx.filter((r) => r.form !== 'external' && parseUsage(r.usage).times !== null).map((r) => r.days))
  if (!days) return undefined
  const d = new Date(`${e.date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d
}
