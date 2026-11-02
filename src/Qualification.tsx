import type { Action } from './store'
import type { Patient } from './types'

// 仮。資格確認の担当が作る。受付の行と患者の帯に置く札（押すと確認のウインドウ）
export function QualBadge({ patient }: { patient: Patient; dispatch: (a: Action) => void; compact?: boolean }) {
  return <span className="hidden">{patient.id}</span>
}

// 受付の見出しの右に置く「新患登録」
export function NewPatientButton({ patients }: { patients: Patient[]; dispatch: (a: Action) => void }) {
  return <span className="hidden">{patients.length}</span>
}
