import { DRUG_INDICATIONS, age, today } from '../data'
import { currentRx, hasDisease, latestLab, latestVitals } from '../karte'
import { labItem } from '../labData'
import { Paper } from '../print'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Boxes, Checks, Choice, ClinicSign, DateField, Row, Section, Table, Text, list, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 特定健診（40〜74歳）・後期高齢者健診と、市町村のがん検診の結果票。
// 身体計測・血圧・検査値はカルテ（直近のバイタル・外注検査の結果）から埋め、メタボ判定と保健指導レベルは自動で出す。
// ※ 判定基準は「標準的な健診・保健指導プログラム」を目安にした仮の計算。本番前に最新の基準・市町村の様式で確かめる

const KINDS = ['特定健診', '後期高齢者健診', '市町村の一般健診']
const CANCERS = ['胃がん', '大腸がん', '肺がん', '前立腺がん', '子宮頸がん', '乳がん']
const CANCER_METHOD: Record<string, string> = {
  胃がん: '胃内視鏡',
  大腸がん: '便潜血（2回法）',
  肺がん: '胸部X線',
  前立腺がん: 'PSA',
  子宮頸がん: '細胞診',
  乳がん: 'マンモグラフィ',
}
const CANCER_RESULTS = ['異常なし', '要精密検査', '判定保留']
const JUDGES = ['異常なし', '要経過観察', '要生活改善', '要医療', '要精密検査', '治療中']
const QUAL = ['−', '±', '1+', '2+', '3+']

// 結果票に載せる検査（特定健診の必須・詳細項目と、内科でよく足す項目）
const LABS: { code: string; label?: string }[] = [
  { code: 'TG', label: '中性脂肪' },
  { code: 'HDL', label: 'HDL-C' },
  { code: 'LDL', label: 'LDL-C' },
  { code: 'GLU', label: '血糖' },
  { code: 'HBA1C' },
  { code: 'AST' },
  { code: 'ALT' },
  { code: 'GGT' },
  { code: 'CRE', label: 'クレアチニン' },
  { code: 'EGFR' },
  { code: 'UA', label: '尿酸' },
  { code: 'Hb', label: '血色素量' },
]

const n = (f: DocFields, k: string) => {
  const x = parseFloat(str(f, k))
  return Number.isNaN(x) ? undefined : x
}

// 服薬：薬の適応か病名から（降圧薬・血糖を下げる薬・脂質を下げる薬）
const onMed = (p: Patient, re: RegExp) => hasDisease(p, re) || currentRx(p).some((r) => DRUG_INDICATIONS[r.drugId]?.some((d) => re.test(d)))

const init = (p: Patient): DocFields => {
  const v = latestVitals(p)
  const lab = (c: string) => {
    const x = latestLab(p, c)
    return x ? String(x.value) : ''
  }
  const a = age(p.birth)
  const yesNo = (b: boolean) => (b ? 'はい' : 'いいえ')
  return {
    kind: a >= 75 ? '後期高齢者健診' : '特定健診',
    cancers: [],
    date: today(),
    height: '',
    weight: v.bw ? String(v.bw) : '',
    waist: '',
    sbp: v.sbp ? String(v.sbp) : '',
    dbp: v.dbp ? String(v.dbp) : '',
    fasting: '空腹時',
    ...Object.fromEntries(LABS.map((l) => [`lab_${l.code}`, lab(l.code)])),
    upro: lab('UPRO'),
    uglu: lab('UGLU'),
    ecg: '',
    fundus: '',
    smoking: '',
    medBP: yesNo(onMed(p, /高血圧/)),
    medGlu: yesNo(onMed(p, /糖尿病/)),
    medLipid: yesNo(onMed(p, /脂質異常/)),
    ...Object.fromEntries(CANCERS.map((c) => [`ca_${c}`, ''])),
    ...Object.fromEntries(CANCERS.map((c) => [`caNote_${c}`, ''])),
    judge: '',
    comment: '',
  }
}

// メタボリックシンドローム判定と特定保健指導の階層化（仮の計算）
function assess(p: Patient, f: DocFields) {
  const male = p.sex === '男'
  const waist = n(f, 'waist')
  const h = n(f, 'height')
  const w = n(f, 'weight')
  const bmi = h && w ? w / (h / 100) ** 2 : undefined
  const sbp = n(f, 'sbp') ?? 0
  const dbp = n(f, 'dbp') ?? 0
  const tg = n(f, 'lab_TG')
  const hdl = n(f, 'lab_HDL')
  const glu = n(f, 'lab_GLU')
  const a1c = n(f, 'lab_HBA1C')
  const fasting = str(f, 'fasting') !== '随時'
  const med = { bp: str(f, 'medBP') === 'はい', glu: str(f, 'medGlu') === 'はい', lipid: str(f, 'medLipid') === 'はい' }
  const big = waist === undefined ? undefined : waist >= (male ? 85 : 90)
  const tgHigh = tg !== undefined && tg >= (fasting ? 150 : 175)

  // メタボ：腹囲＋（血圧・脂質・血糖）のうち2つ以上で基準該当、1つで予備群
  const mBP = sbp >= 130 || dbp >= 85 || med.bp
  const mLipid = tgHigh || (hdl !== undefined && hdl < 40) || med.lipid
  const mGlu = (fasting && glu !== undefined ? glu >= 110 : a1c !== undefined && a1c >= 6.0) || med.glu
  const mCount = [mBP, mLipid, mGlu].filter(Boolean).length
  const metabo = big === undefined ? '判定不能（腹囲が未入力）' : !big ? '非該当' : mCount >= 2 ? '基準該当' : mCount === 1 ? '予備群該当' : '非該当'

  // 階層化：ステップ1 腹囲かBMI、ステップ2 追加リスク（血糖・脂質・血圧、喫煙は他に1つ以上あるときだけ数える）
  const step1 = big ? 1 : bmi !== undefined && bmi >= 25 ? 2 : big === undefined && bmi === undefined ? undefined : 0
  const rGlu = (fasting && glu !== undefined && glu >= 100) || (a1c !== undefined && a1c >= 5.6) || med.glu
  const rLipid = tgHigh || (hdl !== undefined && hdl < 40) || med.lipid
  const rBP = sbp >= 130 || dbp >= 85 || med.bp
  const base = [rGlu, rLipid, rBP].filter(Boolean).length
  const risks = base + (base > 0 && str(f, 'smoking') === '吸う' ? 1 : 0)
  let level =
    step1 === undefined
      ? '判定不能（腹囲・身長が未入力）'
      : step1 === 0
        ? '情報提供（腹囲・BMIが基準未満）'
        : step1 === 1
          ? risks >= 2
            ? '積極的支援'
            : risks === 1
              ? '動機付け支援'
              : '情報提供'
          : risks >= 3
            ? '積極的支援'
            : risks >= 1
              ? '動機付け支援'
              : '情報提供'
  const support = level === '積極的支援' || level === '動機付け支援'
  if (str(f, 'kind') !== '特定健診') level = '対象外（特定健診ではない）'
  else if (support && (med.bp || med.glu || med.lipid)) level = '対象外（服薬中のため医療で管理）'
  else if (level === '積極的支援' && age(p.birth) >= 65) level = '動機付け支援（65歳以上）'
  return { bmi, metabo, level }
}

const flagOf = (code: string, v: string) => {
  const it = labItem(code)
  const x = parseFloat(v)
  if (!it || Number.isNaN(x)) return ''
  if (it.high !== undefined && x > it.high) return 'H'
  if (it.low !== undefined && x < it.low) return 'L'
  return ''
}

const range = (code: string) => {
  const it = labItem(code)
  if (!it) return ''
  return it.low !== undefined && it.high !== undefined ? `${it.low}〜${it.high}` : it.high !== undefined ? `${it.high}以下` : it.low !== undefined ? `${it.low}以上` : ''
}

// 数値の入力（小さく並べる）。基準値から外れたら H / L を出す
function Num({ label, value, onChange, unit, flag, from }: { label: string; value: string; onChange: (v: string) => void; unit?: string; flag?: string; from?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 flex items-center gap-1 truncate text-[11px] text-mist">
        {label}
        {from && value && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-clinical" title="カルテから" />}
      </span>
      <span className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          className={`field h-8 w-full min-w-0 px-2 text-right font-num text-[13px] ${flag ? 'border-error/60 text-error' : ''}`}
        />
        <span className="w-12 shrink-0 truncate text-[10px] text-mist">
          {flag && <b className="mr-0.5 text-error">{flag}</b>}
          {unit}
        </span>
      </span>
    </label>
  )
}

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const { bmi, metabo, level } = assess(patient, f)
  const cancers = list(f, 'cancers')
  return (
    <>
      <Section title="健診の種類">
        <Choice value={str(f, 'kind')} options={KINDS} onChange={(v) => set({ kind: v })} />
        <Checks label="がん検診（市町村委託）" value={cancers} options={CANCERS} onChange={(v) => set({ cancers: v })} />
        <div className="w-48">
          <DateField label="受診日" value={str(f, 'date')} onChange={(v) => set({ date: v })} />
        </div>
      </Section>

      <Section title="身体計測・血圧" note="● はカルテから">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
          <Num label="身長" value={str(f, 'height')} onChange={(v) => set({ height: v })} unit="cm" />
          <Num label="体重" value={str(f, 'weight')} onChange={(v) => set({ weight: v })} unit="kg" from />
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-mist">BMI（自動）</span>
            <span className="flex h-8 items-center justify-end rounded-md bg-cream px-2 font-num text-[13px]">{bmi ? bmi.toFixed(1) : '—'}</span>
          </label>
          <Num label="腹囲" value={str(f, 'waist')} onChange={(v) => set({ waist: v })} unit="cm" />
          <Num label="収縮期血圧" value={str(f, 'sbp')} onChange={(v) => set({ sbp: v })} unit="mmHg" from flag={(n(f, 'sbp') ?? 0) >= 130 ? 'H' : ''} />
          <Num label="拡張期血圧" value={str(f, 'dbp')} onChange={(v) => set({ dbp: v })} unit="mmHg" from flag={(n(f, 'dbp') ?? 0) >= 85 ? 'H' : ''} />
        </div>
      </Section>

      <Section title="血液検査" note="外注検査の直近の値から">
        <Choice value={str(f, 'fasting')} options={['空腹時', '随時']} onChange={(v) => set({ fasting: v })} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
          {LABS.map((l) => {
            const k = `lab_${l.code}`
            const it = labItem(l.code)
            return <Num key={l.code} label={l.label ?? it?.name ?? l.code} value={str(f, k)} onChange={(v) => set({ [k]: v })} unit={it?.unit} flag={flagOf(l.code, str(f, k))} from />
          })}
        </div>
      </Section>

      <Section title="尿・心電図・眼底">
        <div className="grid grid-cols-2 gap-3">
          <Choice label="尿蛋白" value={str(f, 'upro')} options={QUAL} onChange={(v) => set({ upro: v })} />
          <Choice label="尿糖" value={str(f, 'uglu')} options={QUAL} onChange={(v) => set({ uglu: v })} />
        </div>
        <Text label="心電図所見" value={str(f, 'ecg')} onChange={(v) => set({ ecg: v })} placeholder="例：洞調律 異常なし" />
        <Text label="眼底所見" value={str(f, 'fundus')} onChange={(v) => set({ fundus: v })} placeholder="例：KW 0" />
      </Section>

      <Section title="質問票（判定に使う項目）" note="服薬はカルテの病名・処方から">
        <Choice label="たばこ" value={str(f, 'smoking')} options={['吸う', 'やめた', '吸わない']} onChange={(v) => set({ smoking: v })} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Choice label="降圧薬" value={str(f, 'medBP')} options={['はい', 'いいえ']} onChange={(v) => set({ medBP: v })} />
          <Choice label="血糖を下げる薬" value={str(f, 'medGlu')} options={['はい', 'いいえ']} onChange={(v) => set({ medGlu: v })} />
          <Choice label="脂質を下げる薬" value={str(f, 'medLipid')} options={['はい', 'いいえ']} onChange={(v) => set({ medLipid: v })} />
        </div>
      </Section>

      {cancers.length > 0 && (
        <Section title="がん検診の結果">
          {cancers.map((c) => (
            <div key={c} className="space-y-1.5 rounded-md border border-line p-2.5">
              <div className="text-[13px] font-medium">
                {c}
                <span className="ml-2 text-[11px] font-normal text-mist">{CANCER_METHOD[c]}</span>
              </div>
              <Choice value={str(f, `ca_${c}`)} options={CANCER_RESULTS} onChange={(v) => set({ [`ca_${c}`]: v })} />
              <Text label="所見" value={str(f, `caNote_${c}`)} onChange={(v) => set({ [`caNote_${c}`]: v })} />
            </div>
          ))}
        </Section>
      )}

      <Section title="判定" note="仮の計算（本番前に基準を確認）">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-cream px-3 py-2">
            <div className="text-[11px] text-mist">メタボリックシンドローム</div>
            <div className="text-sm font-semibold">{metabo}</div>
          </div>
          <div className="rounded-md bg-cream px-3 py-2">
            <div className="text-[11px] text-mist">特定保健指導</div>
            <div className="text-sm font-semibold">{level}</div>
          </div>
        </div>
        <Choice label="医師の判断" value={str(f, 'judge')} options={JUDGES} onChange={(v) => set({ judge: v })} />
        <Text label="医師のコメント" value={str(f, 'comment')} onChange={(v) => set({ comment: v })} rows={3} placeholder="例：血圧が高めです。減塩と運動を続けてください。" />
      </Section>
    </>
  )
}

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const { bmi, metabo, level } = assess(patient, f)
  const cancers = list(f, 'cancers')
  const ins = patient.insurer
  const td = 'border-b border-black px-[1.5mm] py-[0.6mm]'
  const rows: [string, string, string, string][] = [
    ['身長', str(f, 'height'), 'cm', ''],
    ['体重', str(f, 'weight'), 'kg', ''],
    ['BMI', bmi ? bmi.toFixed(1) : '', '', '18.5〜24.9'],
    ['腹囲', str(f, 'waist'), 'cm', patient.sex === '男' ? '85未満' : '90未満'],
    ['血圧（収縮期）', str(f, 'sbp'), 'mmHg', '130未満'],
    ['血圧（拡張期）', str(f, 'dbp'), 'mmHg', '85未満'],
    ...LABS.map((l): [string, string, string, string] => {
      const it = labItem(l.code)
      return [l.label ?? it?.name ?? l.code, str(f, `lab_${l.code}`), it?.unit ?? '', range(l.code)]
    }),
    ['尿蛋白', str(f, 'upro'), '', '−'],
    ['尿糖', str(f, 'uglu'), '', '−'],
  ]
  const half = Math.ceil(rows.length / 2)
  const table = (rs: typeof rows) => (
    <table className="w-full border-collapse border border-black text-[9pt]">
      <thead>
        <tr className="bg-[#f2f2f2]">
          <th className={`${td} border-r text-left font-normal`}>項目</th>
          <th className={`${td} border-r font-normal`}>結果</th>
          <th className={`${td} font-normal`}>基準</th>
        </tr>
      </thead>
      <tbody>
        {rs.map(([name, v, unit, ref]) => {
          const code = LABS.find((l) => (l.label ?? labItem(l.code)?.name ?? l.code) === name)?.code
          const flag = code ? flagOf(code, v) : ''
          return (
            <tr key={name}>
              <td className={`${td} border-r`}>{name}</td>
              <td className={`${td} border-r text-right font-num`}>
                {v}
                {v && unit && <span className="ml-[1mm] text-[7pt]">{unit}</span>}
                <span className="inline-block w-[3mm] text-center font-bold">{flag}</span>
              </td>
              <td className={`${td} text-[7.5pt]`}>{ref}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
  return (
    <Paper>
      <h1 className="mb-[3mm] text-center text-[15pt] tracking-[0.1em]">{str(f, 'kind') === '特定健診' ? '特定健康診査 結果通知表' : `${str(f, 'kind')} 結果通知表`}</h1>
      <Table>
        <Row th="氏名">
          <span className="text-[11pt]">{patient.name}</span>
          <span className="ml-[3mm] text-[8pt]">（{patient.kana}）</span>
          <span className="ml-[4mm]">{patient.sex}</span>
          <span className="ml-[4mm]">
            {wareki(patient.birth)}生（{age(patient.birth)}歳）
          </span>
        </Row>
        <Row th="受診日">
          {wareki(str(f, 'date'))}
          {ins && (
            <span className="ml-[6mm] text-[8.5pt]">
              保険者番号 {ins.payer}　記号・番号 {[ins.symbol, ins.number].filter(Boolean).join('・')}
            </span>
          )}
        </Row>
      </Table>

      <div className="mt-[3mm] grid grid-cols-2 gap-[3mm]">
        {table(rows.slice(0, half))}
        {table(rows.slice(half))}
      </div>

      <Table className="mt-[3mm]">
        <Row th="心電図">{str(f, 'ecg')}</Row>
        <Row th="眼底">{str(f, 'fundus')}</Row>
        <Row th="服薬・喫煙">
          降圧薬 {str(f, 'medBP') || '—'}　血糖 {str(f, 'medGlu') || '—'}　脂質 {str(f, 'medLipid') || '—'}　たばこ {str(f, 'smoking') || '—'}
        </Row>
      </Table>

      {cancers.length > 0 && (
        <Table className="mt-[3mm]">
          {cancers.map((c) => (
            <Row key={c} th={`${c}検診`}>
              <span className="text-[8.5pt]">（{CANCER_METHOD[c]}）</span>
              <span className="ml-[2mm]">
                <Boxes options={CANCER_RESULTS} value={str(f, `ca_${c}`)} />
              </span>
              {str(f, `caNote_${c}`) && <span className="ml-[2mm]">{str(f, `caNote_${c}`)}</span>}
            </Row>
          ))}
        </Table>
      )}

      <Table className="mt-[3mm]">
        <Row th="メタボ判定">{metabo}</Row>
        <Row th="保健指導">{level}</Row>
        <Row th="医師の判断">
          <Boxes options={JUDGES} value={str(f, 'judge')} />
        </Row>
        <Row th="コメント" h="18mm">
          {str(f, 'comment')}
        </Row>
      </Table>

      <div className="mt-[4mm]">
        <ClinicSign />
      </div>
    </Paper>
  )
}

export const checkupDoc: DocDef = {
  kind: 'checkup',
  title: '特定健診・がん検診',
  icon: 'health_and_safety',
  desc: '結果票（メタボ判定・保健指導レベルを自動）',
  group: '健診・予防接種',
  init,
  Form,
  Sheet,
}
