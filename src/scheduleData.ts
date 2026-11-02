import type { Appointment } from './types'

// 予約の架空データと診療時間。data.ts から読まれるので、ここでは data.ts の値を使わない（読み込みが循環するため）

// 予約の目的（色分けに使う）
export const PURPOSES = ['定期', '初診', '検査', '健診', '予防接種'] as const
export type Purpose = (typeof PURPOSES)[number]

export const PURPOSE_STYLE: Record<string, { card: string; dot: string }> = {
  定期: { card: 'border-l-clinical bg-[#e6eef4] text-ink', dot: 'bg-clinical' },
  初診: { card: 'border-l-[#c2410c] bg-[#fdeee4] text-ink', dot: 'bg-[#c2410c]' },
  検査: { card: 'border-l-lab bg-lab-ctr text-ink', dot: 'bg-lab' },
  健診: { card: 'border-l-[#0d7d6e] bg-[#e3f4f0] text-ink', dot: 'bg-[#0d7d6e]' },
  予防接種: { card: 'border-l-gold-dark bg-gold-soft text-ink', dot: 'bg-gold-dark' },
}
export const purposeStyle = (p: string) => PURPOSE_STYLE[p] ?? PURPOSE_STYLE['定期']

// 診療時間（架空のクリニック）：平日 9:00〜12:30・14:30〜18:00、土曜は午前のみ、日曜は休診。分で持つ
export const DAY_START = 9 * 60
export const DAY_END = 18 * 60
export const SLOT = 15
export const LUNCH = [12 * 60 + 30, 14 * 60 + 30] as const

export const sessionsOf = (dow: number): [number, number][] =>
  dow === 0
    ? []
    : dow === 6
      ? [[DAY_START, LUNCH[0]]]
      : [
          [DAY_START, LUNCH[0]],
          [LUNCH[1], DAY_END],
        ]

const pad = (n: number) => String(n).padStart(2, '0')
export const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toDate = (s: string) => new Date(`${s}T00:00:00`)
export const addDays = (s: string, n: number) => {
  const d = toDate(s)
  d.setDate(d.getDate() + n)
  return ymdOf(d)
}
export const minOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const hhmmOf = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`

export const isOpenDay = (s: string) => toDate(s).getDay() !== 0
// その時刻が診療時間内か（終わりの時刻は含まない）
export const isOpenAt = (s: string, min: number) => sessionsOf(toDate(s).getDay()).some(([a, b]) => min >= a && min < b)

// 休診日なら前（dir=-1）か後ろ（dir=1）の診療日にずらす
export const snapOpen = (s: string, dir: 1 | -1 = 1) => {
  let d = s
  while (!isOpenDay(d)) d = addDays(d, dir)
  return d
}

const todayStr = () => ymdOf(new Date())

// 患者（p1〜p5）の予約。今日の分は受付の待ち患者に合わせる（p5 は予約なしの来院）。
// p4 は次回まで予約済み、p1 は次回未定（記載の帯の「次回予約」で入れる）
export const initialAppointments = (): Record<string, Appointment[]> => {
  const t = todayStr()
  const a = (id: string, date: string, time: string, purpose: string, minutes = 15, memo?: string): Appointment => ({ id, date, time, minutes, purpose, memo, status: '予約' })
  return {
    p1: [a('ap-p1-1', t, '9:00', '定期')],
    p2: [a('ap-p2-1', t, '9:15', '定期'), a('ap-p2-2', snapOpen(addDays(t, 14)), '9:30', '検査', 30, '上部消化管内視鏡の説明（架空）')],
    p3: [a('ap-p3-1', t, '9:30', '初診', 30, 'Web予約：咳が2週間続く（架空）')],
    p4: [a('ap-p4-1', t, '10:00', '定期'), a('ap-p4-2', snapOpen(addDays(t, 28), -1), '10:00', '定期')],
    p5: [],
  }
}

// カルテのない予約（表示だけ。氏名はすべて架空）。予約表を実際の混み具合に近づけるため
export type ExtraBooking = { id: string; name: string; kana: string; date: string; time: string; minutes: number; purpose: string }

const EXTRA_NAMES: [string, string][] = [
  ['小林 正', 'コバヤシ タダシ'],
  ['中村 由美', 'ナカムラ ユミ'],
  ['加藤 誠', 'カトウ マコト'],
  ['渡辺 恵子', 'ワタナベ ケイコ'],
  ['伊藤 翔', 'イトウ ショウ'],
  ['山本 和子', 'ヤマモト カズコ'],
  ['松本 大輔', 'マツモト ダイスケ'],
  ['井上 さくら', 'イノウエ サクラ'],
  ['木村 修', 'キムラ オサム'],
  ['林 美穂', 'ハヤシ ミホ'],
  ['清水 勇', 'シミズ イサム'],
  ['森 千代', 'モリ チヨ'],
]

// 日付から決まる疑似乱数（開くたびに予約表が変わらないように）
const seeded = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

let extraCache: { day: string; list: ExtraBooking[] } | null = null

export const extraBookings = (): ExtraBooking[] => {
  const t = todayStr()
  if (extraCache?.day === t) return extraCache.list
  const out: ExtraBooking[] = []
  for (let off = -6; off <= 42; off++) {
    const date = addDays(t, off)
    const dow = toDate(date).getDay()
    if (dow === 0) continue
    const rnd = seeded(Number(date.replace(/-/g, '')) % 100000)
    // 今日は患者（p1〜p4）の 9:00〜10:15 を空けておく
    const used = new Set<number>(off === 0 ? [540, 555, 570, 585, 600] : [])
    const count = Math.round((dow === 6 ? 6 : 11) * (off > 14 ? 0.5 : 1) * (0.7 + rnd() * 0.5))
    for (let i = 0; i < count; i++) {
      const sessions = sessionsOf(dow)
      const [s, e] = sessions[Math.floor(rnd() * sessions.length)]
      const min = s + Math.floor(rnd() * ((e - s) / SLOT)) * SLOT
      if (used.has(min)) continue
      used.add(min)
      const r = rnd()
      // 11月はインフルエンザの予防接種が多い
      const purpose = r < 0.55 ? '定期' : r < 0.75 ? '予防接種' : r < 0.87 ? '検査' : r < 0.95 ? '健診' : '初診'
      const [name, kana] = EXTRA_NAMES[Math.floor(rnd() * EXTRA_NAMES.length)]
      out.push({ id: `ex-${date}-${min}`, name, kana, date, time: hhmmOf(min), minutes: purpose === '健診' || purpose === '初診' ? 30 : 15, purpose })
    }
  }
  extraCache = { day: t, list: out }
  return out
}
