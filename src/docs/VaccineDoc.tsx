import { CLINIC, age, today } from '../data'
import { activeDiseases } from '../karte'
import { diseaseLabel } from '../orders'
import { Paper } from '../print'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Boxes, Choice, ClinicSign, DateField, Row, Section, Table, Text, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 予防接種の予診票と接種記録（1回の接種につき1枚）。
// ワクチンを選ぶと接種量・接種方法・定期／任意（年齢から）が入り、予診の答えは病名・アレルギーから先に埋める。
// ※ 定期接種の対象年齢・接種量は年度や製品で変わる。本番前に市町村の実施要領と添付文書で確かめる

type Vaccine = { name: string; dose: string; route: '皮下' | '筋肉内'; routineAge?: number; note?: string }
const VACCINES: Vaccine[] = [
  { name: 'インフルエンザ', dose: '0.5mL', route: '皮下', routineAge: 65 },
  { name: '新型コロナ', dose: '0.3mL', route: '筋肉内', routineAge: 65, note: '製品により量が違う' },
  { name: '高齢者肺炎球菌（PPSV23）', dose: '0.5mL', route: '筋肉内', routineAge: 65 },
  { name: '帯状疱疹（組換え）', dose: '0.5mL', route: '筋肉内', routineAge: 65, note: '2回接種（2か月あけて）' },
  { name: '帯状疱疹（生）', dose: '0.5mL', route: '皮下', routineAge: 65 },
  { name: 'RSウイルス', dose: '0.5mL', route: '筋肉内' },
  { name: 'B型肝炎', dose: '0.5mL', route: '皮下' },
  { name: '破傷風トキソイド', dose: '0.5mL', route: '皮下' },
]
const vaccineOf = (name: string) => VACCINES.find((v) => v.name === name) ?? VACCINES[0]

// 予診の質問（B類定期接種の予診票を目安に）。female は女性にだけ聞く
const QUESTIONS: { key: string; text: string; female?: boolean; ok: 'はい' | 'いいえ' }[] = [
  { key: 'q1', text: '今日受ける予防接種について、説明文を読んで理解しましたか', ok: 'はい' },
  { key: 'q2', text: '現在、何かの病気で医師にかかっていますか', ok: 'いいえ' },
  { key: 'q3', text: '今日、体に具合の悪いところがありますか', ok: 'いいえ' },
  { key: 'q4', text: '最近1か月以内に病気にかかりましたか', ok: 'いいえ' },
  { key: 'q5', text: '今までにけいれん（ひきつけ）を起こしたことがありますか', ok: 'いいえ' },
  { key: 'q6', text: '薬や食品で、発疹・じんましんが出たり、体の具合が悪くなったことがありますか', ok: 'いいえ' },
  { key: 'q7', text: 'これまでに予防接種を受けて具合が悪くなったことがありますか', ok: 'いいえ' },
  { key: 'q8', text: '1か月以内に予防接種を受けましたか', ok: 'いいえ' },
  { key: 'q9', text: '近親者に先天性免疫不全と診断されている方はいますか', ok: 'いいえ' },
  { key: 'q10', text: '現在妊娠している可能性はありますか', female: true, ok: 'いいえ' },
  { key: 'q11', text: '今日の予防接種について質問がありますか', ok: 'いいえ' },
]
const questionsFor = (p: Patient) => QUESTIONS.filter((q) => !q.female || p.sex === '女')

const routineOf = (p: Patient, v: Vaccine) => (v.routineAge !== undefined && age(p.birth) >= v.routineAge ? '定期接種（B類）' : '任意接種')
const COSTS = ['公費（自己負担あり）', '公費（自己負担なし）', '自費']
const SITES = ['左上腕', '右上腕', '左三角筋', '右三角筋']
const nowTime = () => new Date().toTimeString().slice(0, 5)

const applyVaccine = (p: Patient, name: string): DocFields => {
  const v = vaccineOf(name)
  const routine = routineOf(p, v)
  return {
    vaccine: v.name,
    routine,
    dose: v.dose,
    route: v.route,
    site: v.route === '筋肉内' ? '左三角筋' : '左上腕',
    cost: routine === '任意接種' ? '自費' : '公費（自己負担あり）',
  }
}

const init = (p: Patient): DocFields => {
  const dx = activeDiseases(p).map(diseaseLabel)
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.key, q.ok]))
  return {
    ...applyVaccine(p, 'インフルエンザ'),
    ...answers,
    // 病名があれば「医師にかかっている」、アレルギーがあれば「発疹などが出たことがある」
    q2: dx.length ? 'はい' : 'いいえ',
    q2note: dx.join('、'),
    q6: p.allergies.length ? 'はい' : 'いいえ',
    q6note: p.allergies.join('、'),
    temp: '',
    decision: '接種可',
    decisionNote: '',
    consent: '希望する',
    lot: '',
    date: today(),
    time: nowTime(),
    doctor: CLINIC.doctor,
  }
}

const tempFlag = (t: string) => {
  const x = parseFloat(t)
  return !Number.isNaN(x) && x >= 37.5
}

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const v = vaccineOf(str(f, 'vaccine'))
  // 答えが「注意の側」（はい/いいえが想定と逆）になっている質問
  const flagged = questionsFor(patient).filter((q) => str(f, q.key) && str(f, q.key) !== q.ok)
  const fever = tempFlag(str(f, 'temp'))
  return (
    <>
      <Section title="ワクチン" note="選ぶと接種量・方法・定期／任意が入ります">
        <Choice value={str(f, 'vaccine')} options={VACCINES.map((x) => x.name)} onChange={(name) => name && set(applyVaccine(patient, name))} />
        {v.note && <p className="text-xs text-mist">※ {v.note}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Choice label="区分" value={str(f, 'routine')} options={['定期接種（B類）', '任意接種']} onChange={(x) => set({ routine: x })} />
          <Choice label="費用" value={str(f, 'cost')} options={COSTS} onChange={(x) => set({ cost: x })} />
        </div>
      </Section>

      <Section title="予診" note={flagged.length ? `注意 ${flagged.length}件` : '問題なし'}>
        <div className="w-40">
          <Text label="診察前の体温" value={str(f, 'temp')} onChange={(x) => set({ temp: x.replace(/[^\d.]/g, '') })} unit="℃" placeholder="36.5" />
        </div>
        {fever && <p className="text-xs font-medium text-error">37.5℃以上は明らかな発熱のため接種しません</p>}
        <ul className="divide-y divide-line rounded-md border border-line">
          {questionsFor(patient).map((q, i) => {
            const val = str(f, q.key)
            const warn = val && val !== q.ok
            return (
              <li key={q.key} className={`px-2.5 py-1.5 ${warn ? 'bg-[#fff8e6]' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 font-num text-[0.6875rem] text-mist">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[0.7812rem]">{q.text}</span>
                  {(['はい', 'いいえ'] as const).map((a) => (
                    <button key={a} type="button" onClick={() => set({ [q.key]: a })} className={`chip h-7 px-2.5 text-xs ${val === a ? 'chip-on' : ''}`}>
                      {a}
                    </button>
                  ))}
                </div>
                {(q.key === 'q2' || q.key === 'q6') && val === 'はい' && (
                  <input
                    value={str(f, `${q.key}note`)}
                    onChange={(e) => set({ [`${q.key}note`]: e.target.value })}
                    placeholder={q.key === 'q2' ? '病名' : '薬・食品の名前と症状'}
                    className="field mt-1 ml-7 h-7 w-[calc(100%-1.75rem)] px-2 text-[0.75rem]"
                  />
                )}
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="医師の判断">
        <Choice value={str(f, 'decision')} options={['接種可', '見合わせる']} onChange={(x) => set({ decision: x })} />
        {str(f, 'decision') === '見合わせる' && <Text label="見合わせる理由" value={str(f, 'decisionNote')} onChange={(x) => set({ decisionNote: x })} placeholder="例：発熱のため" />}
        <Choice label="本人の意思" value={str(f, 'consent')} options={['希望する', '希望しない']} onChange={(x) => set({ consent: x })} />
      </Section>

      {str(f, 'decision') === '接種可' && (
        <Section title="接種記録">
          <div className="grid grid-cols-2 gap-3">
            <Text label="ロット番号" value={str(f, 'lot')} onChange={(x) => set({ lot: x.toUpperCase() })} placeholder="例：AB123C" />
            <Text label="接種量" value={str(f, 'dose')} onChange={(x) => set({ dose: x })} from />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Choice label="方法" value={str(f, 'route')} options={['皮下', '筋肉内']} onChange={(x) => set({ route: x })} />
            <Choice label="部位" value={str(f, 'site')} options={SITES} onChange={(x) => set({ site: x })} />
          </div>
          <div className="grid grid-cols-[1fr_7rem_1fr] gap-3">
            <DateField label="接種日" value={str(f, 'date')} onChange={(x) => set({ date: x })} />
            <label className="block">
              <span className="mb-1 block text-xs text-mist">時刻</span>
              <input type="time" value={str(f, 'time')} onChange={(e) => set({ time: e.target.value })} className="field h-8 w-full px-2 text-[0.8125rem]" />
            </label>
            <Text label="接種医" value={str(f, 'doctor')} onChange={(x) => set({ doctor: x })} />
          </div>
        </Section>
      )}
    </>
  )
}

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const qs = questionsFor(patient)
  const td = 'border-b border-black px-[2mm] py-[0.8mm]'
  const given = str(f, 'decision') === '接種可'
  return (
    <Paper>
      <div className="flex items-baseline justify-between text-[9pt]">
        <span>{str(f, 'routine')}</span>
        <span>{str(f, 'cost')}</span>
      </div>
      <h1 className="mb-[3mm] text-center text-[15pt] tracking-[0.1em]">{str(f, 'vaccine')} 予防接種 予診票</h1>
      <Table>
        <Row th="住所">
          {patient.zip && `〒${patient.zip} `}
          {patient.address}
          {patient.phone && <span className="ml-[3mm]">電話 {patient.phone}</span>}
        </Row>
        <Row th="氏名">
          <span className="text-[11pt]">{patient.name}</span>
          <span className="ml-[3mm] text-[8pt]">（{patient.kana}）</span>
          <span className="ml-[4mm]">{patient.sex}</span>
        </Row>
        <Row th="生年月日">
          {wareki(patient.birth)}（満{age(patient.birth)}歳）
        </Row>
        <Row th="診察前の体温">
          <span className="font-num text-[11pt]">{str(f, 'temp') || '　　　'}</span> ℃
        </Row>
      </Table>

      <table className="mt-[3mm] w-full border-collapse border border-black text-[9pt]">
        <thead>
          <tr className="bg-[#f2f2f2]">
            <th className={`${td} w-[8mm] border-r font-normal`}></th>
            <th className={`${td} border-r text-left font-normal`}>質問事項</th>
            <th className={`${td} w-[34mm] border-r font-normal`}>回答</th>
            <th className={`${td} w-[22mm] font-normal`}>医師記入欄</th>
          </tr>
        </thead>
        <tbody>
          {qs.map((q, i) => (
            <tr key={q.key}>
              <td className={`${td} border-r text-center`}>{i + 1}</td>
              <td className={`${td} border-r`}>
                {q.text}
                {(q.key === 'q2' || q.key === 'q6') && str(f, `${q.key}note`) && str(f, q.key) === 'はい' && <div className="text-[8pt]">（{str(f, `${q.key}note`)}）</div>}
              </td>
              <td className={`${td} border-r text-center whitespace-nowrap`}>
                <Boxes options={['はい', 'いいえ']} value={str(f, q.key)} />
              </td>
              <td className={td}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <Table className="mt-[3mm]">
        <Row th="医師記入欄" h="16mm">
          <div>以上の問診及び診察の結果、今日の予防接種は</div>
          <div className="mt-[1mm]">
            <Boxes options={['実施できる', '見合わせた方がよい']} value={given ? '実施できる' : '見合わせた方がよい'} />
            {!given && str(f, 'decisionNote') && <span className="ml-[3mm]">（{str(f, 'decisionNote')}）</span>}
            <span className="float-right">医師署名　{str(f, 'doctor')}</span>
          </div>
        </Row>
        <Row th="本人の意思" h="14mm">
          <div>医師の診察・説明を受け、予防接種の効果や副反応などについて理解した上で、接種を</div>
          <div className="mt-[1mm]">
            <Boxes options={['希望します', '希望しません']} value={str(f, 'consent') === '希望する' ? '希望します' : '希望しません'} />
            <span className="float-right">本人署名　＿＿＿＿＿＿＿＿＿＿</span>
          </div>
        </Row>
      </Table>

      <table className="mt-[3mm] w-full border-collapse border border-black text-[9pt]">
        <thead>
          <tr className="bg-[#f2f2f2]">
            {['ワクチン名', 'ロット番号', '接種量', '方法・部位', '接種日時', '接種医'].map((h) => (
              <th key={h} className={`${td} border-r font-normal last:border-r-0`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="h-[10mm] text-center">
            <td className={`${td} border-r`}>{str(f, 'vaccine')}</td>
            <td className={`${td} border-r font-num`}>{given ? str(f, 'lot') : ''}</td>
            <td className={`${td} border-r`}>{given ? str(f, 'dose') : ''}</td>
            <td className={`${td} border-r`}>{given ? `${str(f, 'route')}・${str(f, 'site')}` : ''}</td>
            <td className={`${td} border-r text-[8pt]`}>{given ? `${wareki(str(f, 'date'))} ${str(f, 'time')}` : ''}</td>
            <td className={td}>{given ? str(f, 'doctor') : ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-[4mm]">
        <ClinicSign />
      </div>
    </Paper>
  )
}

export const vaccineDoc: DocDef = {
  kind: 'vaccine',
  title: '予防接種',
  icon: 'vaccines',
  desc: '予診票と接種記録（定期／任意を年齢から）',
  group: '健診・予防接種',
  init,
  Form,
  Sheet,
}
