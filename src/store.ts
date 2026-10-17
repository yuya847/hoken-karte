import { DISEASES, SETS, initialPatients, rxFromDrug, testFromCode, today, uid } from './data'
import { diseaseLabel, linkedDiseases } from './orders'
import { parseVitals } from './vitals'
import type { Disease, Draft, Encounter, Patient, RightMode, RxItem, SessionMetric, TestOrder, Vitals } from './types'

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
  | { type: 'do'; encounterId?: string }
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
  | { type: 'applySet'; setId: string }
  | { type: 'letter'; patch: Partial<NonNullable<Draft['letter']>> | null }
  | { type: 'mode'; mode: RightMode }
  | { type: 'savePast'; encounterId: string; text: string; vitals: Vitals }
  | { type: 'confirm' }
  | { type: 'paid'; patientId: string }
  | { type: 'clearMetrics' }
  | { type: 'close' }
  | { type: 'reset' }

const KEY = 'hoken-karte-proto-v1'

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
      return mapDraft(s, (d) => ({ ...d, rx: mergeRx(d.rx, src.rx) }))
    }
    case 'copyLastText': {
      const p = s.patients.find((x) => x.id === s.currentId)
      const src = p && latestWith(p, (e) => e.text.length > 0)
      if (!src) return s
      return mapDraft(s, (d) => ({ ...d, text: d.text ? `${d.text}\n${src.text}` : src.text }))
    }
    case 'addRx':
      return mapDraft(s, (d) => ({ ...d, rx: mergeRx(d.rx, [rxFromDrug(a.drugId)]) }))
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
      return mapPatient(s, (p) => ({ ...p, diseases: p.diseases.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) }))
    case 'applySet': {
      const set = SETS.find((x) => x.id === a.setId)
      if (!set) return s
      let next = mapDraft(s, (d) => ({
        ...d,
        rx: mergeRx(d.rx, set.drugs.map((id) => rxFromDrug(id))),
        tests: mergeTests(d.tests, set.tests.map(testFromCode)),
      }))
      if (set.disease) next = reducer(next, { type: 'addDisease', name: set.disease })
      return next
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
                  version: e.version + 1,
                  history: [...e.history, { version: e.version, savedAt: new Date().toISOString(), text: e.text, vitals: e.vitals }],
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
      const encounter: Encounter = {
        id: uid('enc'),
        date: today(),
        kind: p.encounters.length === 0 ? '初診' : '再診',
        vitals: parseVitals(d.text),
        text: d.text,
        rx: d.rx.map((item) => ({ ...item, diseases: linkedDiseases(p, { kind: 'rx', item }).map(diseaseLabel) })),
        tests: d.tests.map((item) => ({ ...item, diseases: linkedDiseases(p, { kind: 'test', item }).map(diseaseLabel) })),
        letters: d.letter ? [d.letter] : [],
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
        patients: s.patients.map((x) => (x.id === p.id ? { ...x, status: '会計待ち', encounters: [...x.encounters, encounter] } : x)),
        drafts,
        metrics: metric ? [...s.metrics, metric] : s.metrics,
        session: null,
        currentId: null,
        mode: { kind: 'chart' },
      }
      const next = done.patients.find((x) => x.status === '待ち')
      return next ? openPatient(done, next.id) : done
    }
    case 'paid':
      return { ...s, patients: s.patients.map((p) => (p.id === a.patientId ? { ...p, status: '済' } : p)) }
    case 'close':
      return { ...s, currentId: null, mode: { kind: 'chart' } }
    case 'clearMetrics':
      return { ...s, metrics: [] }
    case 'reset':
      return initialState()
  }
}
