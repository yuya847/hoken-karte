import type { Action } from './store'
import type { Draft, Patient } from './types'

// 仮。予約の担当が作る
export function SchedulePage({ patients }: { patients: Patient[]; dispatch: (a: Action) => void; onOpen: (id: string) => void }) {
  return <main className="flex-1 p-6 text-sm text-mist">予約（準備中）{patients.length}</main>
}

// 記載の保存の帯に置く「次回予約」
export function NextVisit({ patient }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void }) {
  return <span className="hidden">{patient.id}</span>
}
