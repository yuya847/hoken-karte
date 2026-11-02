import { activeDiseases, mainDisease } from '../karte'
import { diseaseLabel } from '../orders'
import { today } from '../data'
import { Paper } from '../print'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Checks, Choice, ClinicSign, DateField, PatientLine, Row, Section, Table, Templates, Text, addDays, appendLine, firstVisit, list, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// ---- 診断書 ----

const PURPOSES = ['勤務先提出', '学校提出', '保険会社提出', 'その他']

// 選んだ病名のうち一番早い発病日
const earliestStart = (p: Patient, names: string[]) =>
  activeDiseases(p)
    .filter((d) => names.includes(diseaseLabel(d)))
    .map((d) => d.start)
    .sort()[0] ?? ''

const init = (p: Patient): DocFields => {
  const main = mainDisease(p)
  return {
    purpose: '勤務先提出',
    purposeOther: '',
    diseases: main ? [diseaseLabel(main)] : [],
    extraDx: '',
    onset: main?.start ?? '',
    firstVisit: firstVisit(p),
    restFrom: today(),
    restDays: '7',
    remarks: '',
    issued: today(),
  }
}

const templates = (f: DocFields) => {
  const from = str(f, 'restFrom') || today()
  const n = Math.max(1, Number(str(f, 'restDays')) || 1)
  return [
    { label: '通院加療中', text: `上記疾患にて${wareki(str(f, 'firstVisit'))}より当院に通院加療中である。` },
    { label: '自宅療養を要する', text: `上記により${wareki(from)}から${n}日間（${wareki(addDays(from, n - 1))}まで）の自宅療養を要する。` },
    { label: '就労可能', text: '現在病状は安定しており、通常の勤務は可能である。' },
    { label: '軽作業なら就労可', text: `${wareki(from)}より軽作業であれば就労可能と認める。` },
    { label: '登校可能', text: '現在、他者への感染のおそれはなく、登校は差し支えない。' },
    { label: '定期通院を要する', text: '今後も定期的な通院と経過観察を要する。' },
  ]
}

const dxList = (f: DocFields) => [
  ...list(f, 'diseases'),
  ...str(f, 'extraDx')
    .split(/[、,\n]/)
    .map((x) => x.trim())
    .filter(Boolean),
]

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const opts = activeDiseases(patient).map(diseaseLabel)
  return (
    <>
      <Section title="提出先">
        <Choice value={str(f, 'purpose')} options={PURPOSES} onChange={(v) => set({ purpose: v })} />
        {str(f, 'purpose') === 'その他' && <Text label="提出先（自由記入）" value={str(f, 'purposeOther')} onChange={(v) => set({ purposeOther: v })} placeholder="例：〇〇市役所" />}
      </Section>

      <Section title="病名" note="カルテの病名から選ぶ">
        {opts.length > 0 ? (
          <Checks value={list(f, 'diseases')} options={opts} onChange={(v) => set({ diseases: v, onset: earliestStart(patient, v) || str(f, 'onset') })} />
        ) : (
          <p className="text-xs text-mist">カルテに病名がありません。下に書いてください。</p>
        )}
        <Text label="ほかの病名（、で区切る）" value={str(f, 'extraDx')} onChange={(v) => set({ extraDx: v })} placeholder="例：急性腰痛症" />
        <div className="grid grid-cols-2 gap-3">
          <DateField label="発病年月日" value={str(f, 'onset')} onChange={(v) => set({ onset: v })} from />
          <DateField label="初診年月日" value={str(f, 'firstVisit')} onChange={(v) => set({ firstVisit: v })} from />
        </div>
      </Section>

      <Section title="付記" note="札を押すと文が入ります">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <DateField label="療養・就労の開始日" value={str(f, 'restFrom')} onChange={(v) => set({ restFrom: v })} />
          <Text label="日数" value={str(f, 'restDays')} onChange={(v) => set({ restDays: v.replace(/\D/g, '') })} unit="日" />
        </div>
        <Templates items={templates(f)} onInsert={(t) => set({ remarks: appendLine(str(f, 'remarks'), t) })} />
        <Text label="付記（経過・就労の可否・安静期間など）" value={str(f, 'remarks')} onChange={(v) => set({ remarks: v })} rows={7} />
      </Section>

      <Section title="証明日">
        <div className="w-48">
          <DateField label="証明日" value={str(f, 'issued')} onChange={(v) => set({ issued: v })} />
        </div>
      </Section>
    </>
  )
}

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const purpose = str(f, 'purpose') === 'その他' ? str(f, 'purposeOther') : str(f, 'purpose').replace('提出', '')
  const dx = dxList(f)
  return (
    <Paper>
      <div className="h-[5mm] text-right text-[9pt]">{purpose && `提出先：${purpose}`}</div>
      <h1 className="mt-[4mm] mb-[10mm] text-center text-[22pt] tracking-[0.8em]">診断書</h1>
      <PatientLine patient={patient} />
      <Table className="mt-[5mm]">
        <Row th="病名" h="34mm">
          {dx.map((d, i) => (
            <div key={d} className="text-[11pt]">
              {dx.length > 1 ? `${i + 1}．` : ''}
              {d}
            </div>
          ))}
        </Row>
        <Row th="発病年月日">{wareki(str(f, 'onset'))}</Row>
        <Row th="初診年月日">{wareki(str(f, 'firstVisit'))}</Row>
        <Row th="付記" h="92mm">
          <div className="text-[10.5pt] leading-[1.8]">{str(f, 'remarks')}</div>
        </Row>
      </Table>
      <p className="mt-[6mm] text-[11pt]">上記のとおり診断します。</p>
      <div className="mt-[8mm]">
        <ClinicSign date={str(f, 'issued')} />
      </div>
    </Paper>
  )
}

export const certificateDoc: DocDef = {
  kind: 'certificate',
  title: '診断書',
  icon: 'verified',
  desc: '一般の診断書（勤務先・学校・保険会社）',
  group: '診断書・証明',
  init,
  Form,
  Sheet,
}
