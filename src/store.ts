import { DISEASES, SETS, initialPatients, rxFromDrug, testFromCode, today, uid } from './data'
import { applyPlan, planDiseases } from './orders'
import { parseVitals } from './vitals'
import type { Appointment, Disease, Draft, Encounter, KarteDoc, LabReport, Patient, Payment, Qualification, QueueStatus, RightMode, RxItem, SessionMetric, TestOrder, Vitals } from './types'

export type DoPart = 'text' | 'rx' | 'tests'

export type State = {
  patients: Patient[]
  currentId: string | null
  drafts: Record<string, Draft>
  mode: RightMode
  metrics: SessionMetric[]
  session: { patientId: string; startedAt: number; ops: number } | null
}

export type Action =
  | { type: 'open'; patientId: string }
  | { type: 'op' }
  | { type: 'text'; text: string }
  | { type: 'insertText'; text: string }
  | { type: 'do'; encounterId?: string; parts?: DoPart[] }
  | { type: 'copyLastText' }
  | { type: 'addRx'; drugId: string }
  | { type: 'updateRx'; id: string; patch: Partial<RxItem> }
  | { type: 'removeRx'; id: string }
  | { type: 'addTest'; code: string }
  | { type: 'removeTest'; id: string }
  | { type: 'toggleTest'; code: string }
  | { type: 'setTests'; codes: string[] }
  | { type: 'addDisease'; name: string; suspected?: boolean }
  | { type: 'updateDisease'; id: string; patch: Partial<Disease> }
  | { type: 'dxChoice'; orderId: string; name: string }
  | { type: 'applySet'; setId: string }
  | { type: 'letter'; patch: Partial<NonNullable<Draft['letter']>> | null }
  | { type: 'mode'; mode: RightMode }
  | { type: 'savePast'; encounterId: string; text: string; vitals: Vitals; rx: RxItem[]; tests: TestOrder[] }
  | { type: 'confirm'; then?: 'next' | 'list' } // 確定のあと：next＝次の待ち患者を開く、list＝一覧に戻る
  | { type: 'paid'; patientId: string; payment?: Payment }
  // クリニックの実務（文書・検査結果・予約・資格確認・新患）。カルテの確定とは別にすぐ保存する
  | { type: 'saveDoc'; patientId: string; doc: KarteDoc }
  | { type: 'removeDoc'; patientId: string; id: string }
  | { type: 'addLabs'; items: { patientId: string; report: LabReport }[] }
  | { type: 'reviewLab'; patientId: string; reportId: string; comment?: string }
  | { type: 'saveAppointment'; patientId: string; appt: Appointment }
  | { type: 'removeAppointment'; patientId: string; id: string }
  | { type: 'qualify'; patientId: string; q: Qualification; patch?: Partial<Patient> }
  | { type: 'addPatient'; patient: Patient }
  | { type: 'status'; patientId: string; status: QueueStatus }
  | { type: 'clearMetrics' }
  | { type: 'close' }
  | { type: 'discardDraft'; patientId: string }
  | { type: 'reset' }

const KEY = 'hoken-karte-proto-v3'

export const emptyDraft = (): Draft => ({ vitals: {}, text: '', rx: [], tests: [], letter: null, savedAt: null })

export const initialState = (): State => ({
  patients: initialPatients(),
  currentId: null,
  drafts: {},
  mode: { kind: 'chart' },
  metrics: [],
  session: null,
})

// 端末内保存は試作用。本番では保存の成功・失敗・不明をサーバー応答で区別する。
export const loadState = (): State => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    // 読めなければ初期データで始める
  }
  return initialState()
}

export const saveState = (s: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

const clock = () => new Date().toLocaleTimeString('ja-JP', { hour12: false })

const latestWith = (p: Patient, pred: (e: Encounter) => boolean) =>
  [...p.encounters].sort((a, b) => b.date.localeCompare(a.date)).find(pred)

const mapPatient = (s: State, fn: (p: Patient) => Patient): State =>
  s.currentId ? { ...s, patients: s.patients.map((p) => (p.id === s.currentId ? fn(p) : p)) } : s

const mapById = (s: State, id: string, fn: (p: Patient) => Patient): State => ({ ...s, patients: s.patients.map((p) => (p.id === id ? fn(p) : p)) })

// 同じ id があれば置き換え、なければ足す
const upsert = <T extends { id: string }>(list: T[] | undefined, item: T) =>
  list?.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...(list ?? []), item]

const mapDraft = (s: State, fn: (d: Draft) => Draft): State => {
  if (!s.currentId) return s
  const d = s.drafts[s.currentId] ?? emptyDraft()
  return { ...s, drafts: { ...s.drafts, [s.currentId]: { ...fn(d), savedAt: clock() } } }
}

const mergeRx = (cur: RxItem[], add: RxItem[]) => [
  ...cur,
  ...add.filter((a) => !cur.some((c) => c.drugId === a.drugId)).map((a) => ({ ...a, id: uid('rx') })),
]

const mergeTests = (cur: TestOrder[], add: TestOrder[]) => [
  ...cur,
  ...add.filter((a) => !cur.some((c) => c.code === a.code)).map((a) => ({ ...a, id: uid('t') })),
]

const openPatient = (s: State, patientId: string): State => {
  const patients = s.patients.map((p) => (p.id === patientId && p.status === '待ち' ? { ...p, status: '診察中' as const } : p))
  const session = s.session?.patientId === patientId ? s.session : { patientId, startedAt: Date.now(), ops: 0 }
  return { ...s, patients, currentId: patientId, mode: { kind: 'chart' }, session }
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'open':
      return openPatient(s, a.patientId)
    case 'op':
      return s.session ? { ...s, session: { ...s.session, ops: s.session.ops + 1 } } : s
    case 'text':
      return mapDraft(s, (d) => ({ ...d, text: a.text }))
    case 'insertText':
      return mapDraft(s, (d) => ({ ...d, text: d.text ? `${d.text}\n${a.text}` : a.text }))
    case 'do': {
      const p = s.patients.find((x) => x.id === s.currentId)
      if (!p) return s
      const src = a.encounterId ? p.encounters.find((e) => e.id === a.encounterId) : latestWith(p, (e) => e.rx.length > 0)
      if (!src) return s
      // parts を指定しなければ処方だけ（⌘D・Doボタン）。過去の記録を右へドラッグしたときは記載・検査も
      const parts = a.parts ?? ['rx']
      return mapDraft(s, (d) => ({
        ...d,
        text: parts.includes('text') && src.text ? (d.text ? `${d.text}\n${src.text}` : src.text) : d.text,
        rx: parts.includes('rx') ? mergeRx(d.rx, src.rx) : d.rx,
        tests: parts.includes('tests') ? mergeTests(d.tests, src.tests) : d.tests,
      }))
    }
    case 'copyLastText': {
      const p = s.patients.find((x) => x.id === s.currentId)
      const src = p && latestWith(p, (e) => e.text.length > 0)
      if (!src) return s
      return mapDraft(s, (d) => ({ ...d, text: d.text ? `${d.text}\n${src.text}` : src.text }))
    }
    // 1回量・1日の回数・用法・日数は入れない（処方の表のその行でキーボードで選ぶ）。Do・セットは前回・セットの値のまま
    case 'addRx':
      return mapDraft(s, (d) => ({ ...d, rx: mergeRx(d.rx, [{ ...rxFromDrug(a.drugId), usage: '', dose: 0, days: 0, perUse: undefined }]) }))
    case 'updateRx':
      return mapDraft(s, (d) => ({ ...d, rx: d.rx.map((r) => (r.id === a.id ? { ...r, ...a.patch } : r)) }))
    case 'removeRx':
      return mapDraft(s, (d) => ({ ...d, rx: d.rx.filter((r) => r.id !== a.id) }))
    case 'addTest':
      return mapDraft(s, (d) => ({ ...d, tests: mergeTests(d.tests, [testFromCode(a.code)]) }))
    case 'toggleTest':
      return mapDraft(s, (d) =>
        d.tests.some((t) => t.code === a.code) ? { ...d, tests: d.tests.filter((t) => t.code !== a.code) } : { ...d, tests: mergeTests(d.tests, [testFromCode(a.code)]) },
      )
    case 'setTests':
      return mapDraft(s, (d) => ({ ...d, tests: mergeTests([], a.codes.map(testFromCode)) }))
    case 'removeTest':
      return mapDraft(s, (d) => ({ ...d, tests: d.tests.filter((t) => t.id !== a.id) }))
    case 'addDisease': {
      if (!DISEASES.some((x) => x.name === a.name)) return s
      const suspected = a.suspected ?? false
      return mapPatient(s, (p) => {
        const cur = p.diseases.find((x) => x.name === a.name && x.status === '継続')
        // 同じ病名が「疑い」で付いていて確定で追加されたら、疑いを外す
        if (cur) return cur.suspected && !suspected ? { ...p, diseases: p.diseases.map((x) => (x.id === cur.id ? { ...x, suspected: false } : x)) } : p
        const main = !p.diseases.some((x) => x.status === '継続' && x.main) && !suspected
        return { ...p, diseases: [...p.diseases, { id: uid('dis'), name: a.name, start: today(), main, status: '継続', suspected }] }
      })
    }
    case 'updateDisease':
      // 手で直したら自動の印は外す
      return mapPatient(s, (p) => ({ ...p, diseases: p.diseases.map((x) => (x.id === a.id ? { ...x, ...a.patch, auto: undefined } : x)) }))
    case 'dxChoice':
      return mapDraft(s, (d) => ({ ...d, dxChoice: { ...d.dxChoice, [a.orderId]: a.name } }))
    case 'applySet': {
      const set = SETS.find((x) => x.id === a.setId)
      if (!set) return s
      // 病名はセットに持たせず、オーダーから確定時に自動で決める
      return mapDraft(s, (d) => ({
        ...d,
        rx: mergeRx(d.rx, set.drugs.map((id) => rxFromDrug(id))),
        tests: mergeTests(d.tests, set.tests.map(testFromCode)),
      }))
    }
    case 'letter':
      return mapDraft(s, (d) => ({
        ...d,
        letter:
          a.patch === null
            ? null
            : { id: d.letter?.id ?? uid('doc'), title: '診療情報提供書', to: '', purpose: '', body: '', createdAt: today(), ...d.letter, ...a.patch },
      }))
    case 'mode':
      return { ...s, mode: a.mode }
    case 'savePast':
      return {
        ...mapPatient(s, (p) => ({
          ...p,
          encounters: p.encounters.map((e) =>
            e.id === a.encounterId
              ? {
                  ...e,
                  text: a.text,
                  vitals: a.vitals,
                  rx: a.rx,
                  tests: a.tests,
                  version: e.version + 1,
                  history: [...e.history, { version: e.version, savedAt: new Date().toISOString(), text: e.text, vitals: e.vitals, rx: e.rx, tests: e.tests }],
                }
              : e,
          ),
        })),
        mode: { kind: 'chart' },
      }
    case 'confirm': {
      const p = s.patients.find((x) => x.id === s.currentId)
      if (!p) return s
      const d = s.drafts[p.id] ?? emptyDraft()
      const plan = planDiseases(p, d)
      const dx = applyPlan(p, plan)
      const encounter: Encounter = {
        id: uid('enc'),
        date: today(),
        kind: p.encounters.length === 0 ? '初診' : '再診',
        vitals: parseVitals(d.text),
        text: d.text,
        rx: d.rx.map((item) => ({ ...item, diseases: plan.links[item.id] ?? [] })),
        tests: d.tests.map((item) => ({ ...item, diseases: plan.links[item.id] ?? [] })),
        letters: d.letter ? [d.letter] : [],
        dxLog: dx.log,
        version: 1,
        history: [],
      }
      const metric: SessionMetric | null = s.session
        ? {
            patientId: p.id,
            patientName: p.name,
            kind: encounter.kind,
            seconds: Math.round((Date.now() - s.session.startedAt) / 1000),
            ops: s.session.ops,
            at: new Date().toISOString(),
          }
        : null
      const drafts = { ...s.drafts }
      delete drafts[p.id]
      const done: State = {
        ...s,
        patients: s.patients.map((x) => (x.id === p.id ? { ...x, status: '会計待ち', diseases: dx.diseases, encounters: [...x.encounters, encounter] } : x)),
        drafts,
        metrics: metric ? [...s.metrics, metric] : s.metrics,
        session: null,
        currentId: null,
        mode: { kind: 'chart' },
      }
      const next = a.then === 'list' ? undefined : done.patients.find((x) => x.status === '待ち')
      return next ? openPatient(done, next.id) : done
    }
    case 'paid':
      return mapById(s, a.patientId, (p) => ({ ...p, status: '済', payments: a.payment ? [...(p.payments ?? []), a.payment] : p.payments }))
    case 'saveDoc':
      return mapById(s, a.patientId, (p) => ({ ...p, docs: upsert(p.docs, a.doc) }))
    case 'removeDoc':
      return mapById(s, a.patientId, (p) => ({ ...p, docs: p.docs?.filter((d) => d.id !== a.id) }))
    case 'addLabs':
      return { ...s, patients: s.patients.map((p) => ({ ...p, labs: a.items.filter((x) => x.patientId === p.id).reduce((l, x) => upsert(l, x.report), p.labs) })) }
    case 'reviewLab':
      return mapById(s, a.patientId, (p) => ({ ...p, labs: p.labs?.map((r) => (r.id === a.reportId ? { ...r, reviewed: true, comment: a.comment ?? r.comment } : r)) }))
    case 'saveAppointment':
      return mapById(s, a.patientId, (p) => ({ ...p, appointments: upsert(p.appointments, a.appt) }))
    case 'removeAppointment':
      return mapById(s, a.patientId, (p) => ({ ...p, appointments: p.appointments?.filter((x) => x.id !== a.id) }))
    case 'qualify':
      return mapById(s, a.patientId, (p) => ({ ...p, ...a.patch, qualification: a.q }))
    case 'addPatient':
      return { ...s, patients: [...s.patients, a.patient] }
    case 'status':
      return { ...s, patients: s.patients.map((p) => (p.id === a.patientId ? { ...p, status: a.status } : p)) }
    case 'discardDraft': {
      const drafts = { ...s.drafts }
      delete drafts[a.patientId]
      return { ...s, drafts }
    }
    case 'close':
      return { ...s, currentId: null, mode: { kind: 'chart' } }
    case 'clearMetrics':
      return { ...s, metrics: [] }
    case 'reset':
      return initialState()
  }
}
