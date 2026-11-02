import type { Encounter, Patient } from './types'

// 仮。院外処方箋の担当が作る。押すと処方箋のウインドウ（印刷イメージ）を開くボタン
export function PrescriptionButton({ patient, encounter }: { patient: Patient; encounter: Encounter; compact?: boolean }) {
  return <span className="hidden">{patient.id + encounter.id}</span>
}
