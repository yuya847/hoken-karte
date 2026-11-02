import { today } from '../data'
import { activeDiseases, byDateDesc, currentRx } from '../karte'
import { diseaseLabel } from '../orders'
import { Paper } from '../print'
import { rxLine } from '../rxFormat'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Choice, ClinicSign, PatientLine, Row, Section, Table, Text, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 紹介状の返書（紹介元への報告）。紹介を受けた患者について、診断・経過・今後の方針・処方を返す。
// 傷病名・経過・処方はカルテから埋め、挨拶文は定型を入れておく（すべて直せる）

const PLANS = ['当院で継続して診療いたします', '貴院へ逆紹介いたします', '専門医療機関へ紹介いたしました', '治療を終了いたしました']
const GREETING = '平素より大変お世話になっております。\nこのたびは上記の患者様をご紹介いただき、誠にありがとうございました。下記のとおりご報告申し上げます。'
const CLOSING = '今後ともどうぞよろしくお願い申し上げます。'

// カルテから引ける値（Form では「カルテから」の印を出すのに使う）
const fromKarte = (p: Patient) => {
  const last = byDateDesc(p.encounters)[0]
  return {
    visitDate: last?.date ?? today(),
    diagnosis: activeDiseases(p).map(diseaseLabel).join('、'),
    course: last?.text ?? '',
    rx: currentRx(p).map(rxLine).join('\n'),
  }
}

const init = (p: Patient): DocFields => {
  const k = fromKarte(p)
  return {
    date: today(),
    to: '',
    toDoctor: '',
    refDate: '',
    visitDate: k.visitDate,
    greeting: GREETING,
    diagnosis: k.diagnosis,
    course: k.course,
    plan: PLANS[0],
    planNote: '',
    rx: k.rx,
    closing: CLOSING,
  }
}

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const k = fromKarte(patient)
  const t = (key: string, label: string, opt: { rows?: number; placeholder?: string; karte?: string } = {}) => (
    <Text label={label} value={str(f, key)} onChange={(v) => set({ [key]: v })} rows={opt.rows} placeholder={opt.placeholder} from={!!opt.karte && str(f, key) === opt.karte} />
  )
  const date = (key: string, label: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-mist">{label}</span>
      <input type="date" value={str(f, key)} onChange={(e) => set({ [key]: e.target.value })} className="field h-8 w-full px-2 text-[0.8125rem]" />
    </label>
  )
  return (
    <>
      <Section title="宛先">
        <div className="grid grid-cols-2 gap-2">
          {t('to', '紹介元の医療機関・診療科', {
            placeholder: '例：〇〇病院 循環器内科',
          })}
          {t('toDoctor', '医師名', { placeholder: '例：〇〇 〇〇' })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {date('refDate', '紹介状の日付')}
          {date('visitDate', '当院の受診日')}
          {date('date', '作成日')}
        </div>
      </Section>
      <Section title="報告">
        {t('greeting', '挨拶文', { rows: 3 })}
        {t('diagnosis', '傷病名', { rows: 2, karte: k.diagnosis })}
        {t('course', '経過・所見・検査結果', { rows: 6, karte: k.course })}
      </Section>
      <Section title="今後の方針">
        <Choice value={str(f, 'plan')} options={PLANS} onChange={(v) => set({ plan: v })} />
        {t('planNote', '補足', {
          rows: 2,
          placeholder: '例：3か月ごとに血液検査を行い、結果をご報告いたします',
        })}
      </Section>
      <Section title="処方" note="最後に処方した日の内容">
        {t('rx', '処方', { rows: 4, karte: k.rx })}
        {t('closing', '結び', {})}
      </Section>
    </>
  )
}

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const md = (d: string) => (d ? wareki(d) : '')
  return (
    <Paper>
      <h1 className="mb-[6mm] text-center text-[16pt] font-bold tracking-[0.2em]">診療情報提供書（ご報告）</h1>
      <div className="flex items-start justify-between gap-[6mm]">
        <div className="pt-[2mm] text-[11pt] leading-[1.8]">
          <div className="border-b border-black pr-[4mm]">{str(f, 'to') || '　　　　　　　　'}　御中</div>
          <div className="border-b border-black pr-[4mm]">{str(f, 'toDoctor') || '　　　　　　'}　先生　御侍史</div>
        </div>
        <ClinicSign date={str(f, 'date')} />
      </div>
      <div className="mt-[5mm]">
        <PatientLine patient={patient} />
      </div>
      <p className="mt-[4mm] whitespace-pre-wrap">{str(f, 'greeting')}</p>
      <Table className="mt-[3mm]">
        <Row th="紹介日・受診日">
          {str(f, 'refDate') ? `${md(str(f, 'refDate'))}付のご紹介` : 'ご紹介'}
          {str(f, 'visitDate') && `／${md(str(f, 'visitDate'))} 当院受診`}
        </Row>
        <Row th="傷病名">{str(f, 'diagnosis')}</Row>
        <Row th="経過・所見" h="62mm">
          {str(f, 'course')}
        </Row>
        <Row th="今後の方針" h="18mm">
          {str(f, 'plan')}
          {str(f, 'planNote') && `\n${str(f, 'planNote')}`}
        </Row>
        <Row th="処方" h="30mm">
          {str(f, 'rx') || 'なし'}
        </Row>
      </Table>
      <p className="mt-[4mm]">{str(f, 'closing')}</p>
    </Paper>
  )
}

export const replyDoc: DocDef = {
  kind: 'reply',
  title: '紹介状の返書',
  icon: 'reply',
  desc: '紹介元への報告。傷病名・経過・処方をカルテから',
  group: '紹介・返書',
  init,
  Form,
  Sheet,
}
