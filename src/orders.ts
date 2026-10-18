import { DRUG_INDICATIONS, TEST_INDICATIONS, today } from './data'
import type { Disease, Draft, Patient, RxItem, TestOrder } from './types'

export const diseaseLabel = (d: Pick<Disease, 'name' | 'suspected'>) => `${d.name}${d.suspected ? 'の疑い' : ''}`

export type OrderRef = { kind: 'rx'; item: RxItem } | { kind: 'test'; item: TestOrder }

export const indications = (o: OrderRef) => (o.kind === 'rx' ? DRUG_INDICATIONS[o.item.drugId] : TEST_INDICATIONS[o.item.code]) ?? []

export const draftOrders = (d: Draft): OrderRef[] => [...d.rx.map((item) => ({ kind: 'rx' as const, item })), ...d.tests.map((item) => ({ kind: 'test' as const, item }))]

// 一定期間で治る病名。オーダーが付かなくなって30日を過ぎたら「治癒」にする
const ACUTE = new Set(['急性上気道炎', '急性気管支炎', '急性胃炎', '頭痛', '腰痛症', 'インフルエンザ', 'COVID-19', '肺炎'])
const ACUTE_DAYS = 30

export type DxAdd = { orderId: string; order: string; name: string; suspected: boolean; options: string[] }
export type DxConfirm = { id: string; name: string; order: string }
export type DxClose = { id: string; name: string; label: string; status: '治癒' | '中止'; reason: string }
export type DxPlan = { add: DxAdd[]; confirm: DxConfirm[]; close: DxClose[]; links: Record<string, string[]> }

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

// オーダーから病名を自動で決める。
// ・検査：継続中の病名（疑い含む）に適応があれば紐付け、なければ適応の先頭を「疑い」で追加
// ・処方：確定病名に紐付け。疑いしかなければ確定に切り替え、なければ適応の先頭を確定で追加
// ・今回どのオーダーにも紐付かない病名：疑いは前月以前なら「中止」、急性疾患は30日超で「治癒」
export function planDiseases(patient: Patient, d: Draft, on = today()): DxPlan {
  const plan: DxPlan = { add: [], confirm: [], close: [], links: {} }
  const active = patient.diseases.filter((x) => x.status === '継続')
  const used = new Set<string>()
  // 処方を先に見る（処方で確定にした病名へ検査も紐付けられる）
  for (const o of draftOrders(d)) {
    const ind = indications(o)
    if (ind.length === 0) continue
    const isRx = o.kind === 'rx'
    const hitConfirmed = active.find((x) => ind.includes(x.name) && (!x.suspected || plan.confirm.some((c) => c.id === x.id)))
    const hitSuspected = active.find((x) => ind.includes(x.name) && x.suspected)
    const added = plan.add.find((a) => ind.includes(a.name) && (!isRx || !a.suspected))
    if (hitConfirmed) {
      used.add(hitConfirmed.id)
      plan.links[o.item.id] = [hitConfirmed.name]
    } else if (hitSuspected && !isRx) {
      used.add(hitSuspected.id)
      plan.links[o.item.id] = [diseaseLabel(hitSuspected)]
    } else if (hitSuspected && isRx) {
      used.add(hitSuspected.id)
      plan.confirm.push({ id: hitSuspected.id, name: hitSuspected.name, order: o.item.name })
      plan.links[o.item.id] = [hitSuspected.name]
    } else if (added) {
      plan.links[o.item.id] = [diseaseLabel(added)]
    } else {
      const choice = d.dxChoice?.[o.item.id]
      const name = choice && ind.includes(choice) ? choice : ind[0]
      const sameSuspectedAdd = plan.add.find((a) => a.name === name)
      if (sameSuspectedAdd) sameSuspectedAdd.suspected = sameSuspectedAdd.suspected && !isRx
      else plan.add.push({ orderId: o.item.id, order: o.item.name, name, suspected: !isRx, options: ind })
      plan.links[o.item.id] = [isRx ? name : `${name}の疑い`]
    }
  }
  for (const x of active) {
    if (used.has(x.id)) continue
    if (x.suspected && x.start.slice(0, 7) < on.slice(0, 7))
      plan.close.push({ id: x.id, name: x.name, label: diseaseLabel(x), status: '中止', reason: '疑い病名の放置防止（前月以前・今回オーダーなし）' })
    else if (!x.suspected && ACUTE.has(x.name) && daysBetween(x.start, on) > ACUTE_DAYS)
      plan.close.push({ id: x.id, name: x.name, label: x.name, status: '治癒', reason: `急性疾患（${ACUTE_DAYS}日超・今回オーダーなし）` })
  }
  return plan
}

export const planIsEmpty = (p: DxPlan) => p.add.length + p.confirm.length + p.close.length === 0

// 確定時に病名一覧へ反映する。自動で変えたものには理由を残す
export function applyPlan(patient: Patient, plan: DxPlan, on = today()): { diseases: Disease[]; log: string[]; newIds: string[] } {
  const log: string[] = []
  let diseases = patient.diseases.map((x) => {
    const c = plan.confirm.find((y) => y.id === x.id)
    if (c) {
      log.push(`${x.name}：疑い→確定（${c.order}）`)
      return { ...x, suspected: false, auto: `${c.order}の処方で確定` }
    }
    const cl = plan.close.find((y) => y.id === x.id)
    if (cl) {
      log.push(`${cl.label}：${cl.status}（${cl.reason}）`)
      return { ...x, status: cl.status, end: on, main: false, auto: cl.reason }
    }
    return x
  })
  const newIds: string[] = []
  for (const a of plan.add) {
    const id = `dis-${Date.now().toString(36)}-${newIds.length}`
    newIds.push(id)
    const main = !a.suspected && !diseases.some((x) => x.status === '継続' && x.main)
    diseases = [...diseases, { id, name: a.name, start: on, main, status: '継続', suspected: a.suspected, auto: `${a.order}から自動追加` }]
    log.push(`${diseaseLabel(a)}：追加（${a.order}）`)
  }
  // 主病名がなくなったら、継続中の確定病名の先頭を主病名にする
  if (!diseases.some((x) => x.status === '継続' && x.main)) {
    const first = diseases.find((x) => x.status === '継続' && !x.suspected)
    if (first) diseases = diseases.map((x) => (x.id === first.id ? { ...x, main: true } : x))
  }
  return { diseases, log, newIds }
}
