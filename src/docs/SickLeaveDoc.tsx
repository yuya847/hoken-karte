import { TESTS, today } from '../data'
import { activeDiseases, byDateDesc, currentRx, mainDisease } from '../karte'
import { diseaseLabel } from '../orders'
import { Paper } from '../print'
import { rxLine } from '../rxFormat'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Boxes, Checks, Choice, ClinicSign, DateField, Row, Section, Table, Text, addDays, bool, daysBetween, list, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 健康保険 傷病手当金支給申請書の「療養担当者記入用」のページ（協会けんぽの様式を目安にした試作）。
// 労務不能と認めた期間・その間に診療した日・症状経過・治療内容をカルテから埋める。
// ※ 様式の細部（欄の順・文言）は保険者・年度で違うことがあるので、本番前に最新の様式と照らし合わせる

const CAUSES = ['疾病（業務外）', '負傷（業務外）', '不明']
const MAX_DX = 3

// 期間の中の受診日（＋今日）
const visitDays = (p: Patient, f: DocFields) => {
  const from = str(f, 'from')
  const to = str(f, 'to')
  const days = new Set(p.encounters.map((e) => e.date).filter((d) => d >= from && d <= to))
  if (bool(f, 'includeToday') && today() >= from && today() <= to) days.add(today())
  return [...days].sort()
}

// 期間の記録から「主たる症状及び経過」「治療内容・検査結果・療養指導」を作る
const fromRecords = (p: Patient, from: string, to: string) => {
  const inPeriod = byDateDesc(p.encounters)
    .filter((e) => e.date >= from && e.date <= to)
    .reverse()
  const src = inPeriod.length ? inPeriod : byDateDesc(p.encounters).slice(0, 1)
  const course = src.map((e) => `${e.date.slice(5).replace('-', '/')} ${e.text.split('\n').join(' ')}`).join('\n')
  const tests = [...new Set(src.flatMap((e) => e.tests.map((t) => TESTS.find((x) => x.code === t.code)?.name ?? t.name)))]
  const treatment = [
    ...currentRx(p).map((r) => rxLine(r)),
    ...(tests.length ? [`検査：${tests.join('、')}`] : []),
  ].join('\n')
  return { course, treatment }
}

const init = (p: Patient): DocFields => {
  const last = byDateDesc(p.encounters)[0]?.date
  // 前回の受診が60日以内ならそこから今日まで、なければ今日から
  const from = last && daysBetween(last, today()) <= 60 ? last : today()
  const to = today()
  const main = mainDisease(p)
  const dx = activeDiseases(p)
    .filter((d) => !d.suspected)
    .slice(0, 1)
    .map(diseaseLabel)
  return {
    from,
    to,
    diseases: dx.length ? dx : main ? [diseaseLabel(main)] : [],
    onset: main?.start ?? '',
    cause: '疾病（業務外）',
    causeNote: '',
    includeToday: true,
    ...fromRecords(p, from, to),
    dialysis: 'なし',
    dialysisNote: '',
    surgery: 'なし',
    surgeryDate: '',
    issued: today(),
  }
}

// 病名ごとの初診日（カルテの病名の開始日）
const dxStart = (p: Patient, label: string) => activeDiseases(p).find((d) => diseaseLabel(d) === label)?.start ?? ''

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const from = str(f, 'from')
  const to = str(f, 'to')
  const days = daysBetween(from, to)
  const visits = visitDays(patient, f)
  const opts = activeDiseases(patient).map(diseaseLabel)
  const last = byDateDesc(patient.encounters)[0]?.date
  const period = (a: string, b: string) => set({ from: a, to: b })
  return (
    <>
      <Section title="労務不能と認めた期間">
        <div className="grid grid-cols-2 gap-3">
          <DateField label="から" value={from} onChange={(v) => set({ from: v })} />
          <DateField label="まで" value={to} onChange={(v) => set({ to: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className={`mr-2 text-sm font-semibold ${days > 0 ? '' : 'text-error'}`}>{days > 0 ? `${days}日間` : '期間を確認してください'}</span>
          {last && (
            <button type="button" onClick={() => period(last, today())} className="chip h-7 text-xs">
              前回受診日から今日まで
            </button>
          )}
          {[7, 14, 30].map((n) => (
            <button key={n} type="button" onClick={() => period(today(), addDays(today(), n - 1))} className="chip h-7 text-xs">
              今日から{n}日間
            </button>
          ))}
        </div>
      </Section>

      <Section title="傷病名" note={`${MAX_DX}つまで。初診日はカルテの病名の開始日`}>
        <Checks value={list(f, 'diseases')} options={opts} onChange={(v) => set({ diseases: v.slice(0, MAX_DX) })} />
        {list(f, 'diseases').length > 0 && (
          <ul className="space-y-0.5 text-xs text-mist">
            {list(f, 'diseases').map((d) => (
              <li key={d}>
                {d}：初診日 {wareki(dxStart(patient, d))}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="発病または負傷">
        <div className="w-48">
          <DateField label="発病・負傷の年月日" value={str(f, 'onset')} onChange={(v) => set({ onset: v })} from />
        </div>
        <Choice label="原因" value={str(f, 'cause')} options={CAUSES} onChange={(v) => set({ cause: v })} />
        <Text label="原因の補足（負傷の状況など）" value={str(f, 'causeNote')} onChange={(v) => set({ causeNote: v })} placeholder="例：自宅で転倒" />
      </Section>

      <Section title="期間中に診療した日" note="カルテの受診日から自動">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={bool(f, 'includeToday')} onChange={(e) => set({ includeToday: e.target.checked })} className="h-4 w-4 accent-clinical" />
          今日の受診を含める
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {visits.map((d) => (
            <span key={d} className="rounded border border-line bg-white px-1.5 py-0.5 font-num text-xs">
              {d.slice(5).replace('-', '/')}
            </span>
          ))}
          <span className="ml-1 text-sm font-semibold">診療実日数 {visits.length}日</span>
        </div>
      </Section>

      <Section title="症状経過・治療内容">
        <div className="flex justify-end">
          <button type="button" onClick={() => set(fromRecords(patient, from, to))} className="text-xs text-clinical hover:underline">
            期間の記録から作り直す
          </button>
        </div>
        <Text label="主たる症状及び経過" value={str(f, 'course')} onChange={(v) => set({ course: v })} rows={6} from />
        <Text label="治療内容、検査結果、療養指導" value={str(f, 'treatment')} onChange={(v) => set({ treatment: v })} rows={5} from />
      </Section>

      <Section title="人工透析・手術">
        <div className="grid grid-cols-2 gap-3">
          <Choice label="人工透析・人工臓器" value={str(f, 'dialysis')} options={['なし', 'あり']} onChange={(v) => set({ dialysis: v })} />
          <Choice label="手術" value={str(f, 'surgery')} options={['なし', 'あり']} onChange={(v) => set({ surgery: v })} />
        </div>
        {str(f, 'dialysis') === 'あり' && <Text label="種類・開始日" value={str(f, 'dialysisNote')} onChange={(v) => set({ dialysisNote: v })} placeholder="例：血液透析 令和6年4月1日から" />}
        {str(f, 'surgery') === 'あり' && (
          <div className="w-48">
            <DateField label="手術日" value={str(f, 'surgeryDate')} onChange={(v) => set({ surgeryDate: v })} />
          </div>
        )}
      </Section>

      <Section title="記入日">
        <div className="w-48">
          <DateField label="記入日" value={str(f, 'issued')} onChange={(v) => set({ issued: v })} />
        </div>
      </Section>
    </>
  )
}

// 期間の月ごとのカレンダー。診療した日に○
function VisitCalendar({ from, to, visits }: { from: string; to: string; visits: string[] }) {
  if (!from || !to || from > to) return null
  const months: string[] = []
  for (let d = `${from.slice(0, 7)}-01`; d.slice(0, 7) <= to.slice(0, 7) && months.length < 3; d = addDays(d, 32).slice(0, 7) + '-01') months.push(d.slice(0, 7))
  return (
    <div className="space-y-[1mm]">
      {months.map((ym) => {
        const [y, m] = ym.split('-').map(Number)
        const n = new Date(y, m, 0).getDate()
        return (
          <div key={ym} className="flex items-center gap-[1mm]">
            <span className="w-[8mm] shrink-0 text-[8.5pt]">{m}月</span>
            <div className="flex">
              {Array.from({ length: n }, (_, i) => {
                const d = `${ym}-${String(i + 1).padStart(2, '0')}`
                const on = visits.includes(d)
                const inside = d >= from && d <= to
                return (
                  <span
                    key={d}
                    className={`flex h-[3.9mm] w-[3.9mm] items-center justify-center text-[6pt] ${on ? 'rounded-full border border-black font-bold' : ''} ${inside ? '' : 'text-[#aaa]'}`}
                  >
                    {i + 1}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const from = str(f, 'from')
  const to = str(f, 'to')
  const visits = visitDays(patient, f)
  const dx = list(f, 'diseases')
  return (
    <Paper>
      <div className="text-[9pt]">健康保険 傷病手当金 支給申請書</div>
      <h1 className="mb-[4mm] text-center text-[15pt] tracking-[0.15em]">療養担当者記入用</h1>
      <Table>
        <Row th="患者氏名" thW="36mm">
          <span className="text-[11pt]">{patient.name}</span>
          <span className="ml-[4mm] text-[8.5pt]">（{patient.kana}）</span>
          <span className="ml-[4mm] text-[9pt]">生年月日 {wareki(patient.birth)}</span>
        </Row>
        <Row th="労務不能と認めた期間" thW="36mm">
          {wareki(from)} から {wareki(to)} まで
          <span className="ml-[3mm]">（{daysBetween(from, to)}日間）</span>
        </Row>
        <Row th="傷病名" thW="36mm" h="20mm">
          {dx.map((d, i) => (
            <div key={d} className="flex">
              <span className="flex-1">
                （{i + 1}）{d}
              </span>
              <span className="text-[9pt]">初診日 {wareki(dxStart(patient, d))}</span>
            </div>
          ))}
        </Row>
        <Row th="発病または負傷の年月日" thW="36mm">
          {wareki(str(f, 'onset'))}
        </Row>
        <Row th="発病または負傷の原因" thW="36mm">
          <Boxes options={CAUSES} value={str(f, 'cause')} />
          {str(f, 'causeNote') && <span className="ml-[3mm]">（{str(f, 'causeNote')}）</span>}
        </Row>
        <Row th="労務不能と認めた期間に診療した日" thW="36mm">
          <div className="mb-[1mm] flex justify-between text-[9pt]">
            <Boxes options={['はい', 'いいえ']} value={visits.length ? 'はい' : 'いいえ'} />
            <span>診療実日数 {visits.length}日</span>
          </div>
          <VisitCalendar from={from} to={to} visits={visits} />
        </Row>
        <Row th="主たる症状及び経過" thW="36mm" h="46mm">
          <div className="text-[9.5pt] leading-[1.6]">{str(f, 'course')}</div>
        </Row>
        <Row th="治療内容、検査結果、療養指導" thW="36mm" h="36mm">
          <div className="text-[9.5pt] leading-[1.6]">{str(f, 'treatment')}</div>
        </Row>
        <Row th="人工透析・人工臓器" thW="36mm">
          <Boxes options={['なし', 'あり']} value={str(f, 'dialysis')} />
          {str(f, 'dialysis') === 'あり' && <span className="ml-[3mm]">{str(f, 'dialysisNote')}</span>}
        </Row>
        <Row th="手術" thW="36mm">
          <Boxes options={['なし', 'あり']} value={str(f, 'surgery')} />
          {str(f, 'surgery') === 'あり' && <span className="ml-[3mm]">手術日 {wareki(str(f, 'surgeryDate'))}</span>}
        </Row>
      </Table>
      <p className="mt-[4mm]">上記のとおり相違ないことを証明します。</p>
      <div className="mt-[4mm]">
        <ClinicSign date={str(f, 'issued')} />
      </div>
    </Paper>
  )
}

export const sickLeaveDoc: DocDef = {
  kind: 'sickLeave',
  title: '傷病手当金意見書',
  icon: 'work_off',
  desc: '支給申請書の療養担当者記入用（診療日を自動）',
  group: '診断書・証明',
  init,
  Form,
  Sheet,
}
