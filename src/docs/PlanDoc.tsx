import { CLINIC, age, today } from '../data'
import { currentRx, hasDisease, latestLab, latestVitals } from '../karte'
import { Paper } from '../print'
import { birthLabel } from '../PatientIcon'
import { rxLine } from '../rxFormat'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Boxes, Checks, Choice, Section, Text, box, bool, list, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 生活習慣病 療養計画書（生活習慣病管理料）。厚労省の 別紙様式9（初回用）・別紙様式9の2（継続用）の並びに合わせる。
// 2024年6月の改定の様式をもとにした。2026年6月の改定で項目・文言が変わっていないかは本番前に確認する（TODO：2026改定）。
// カルテ（病名・バイタル・検査値・処方）から最初の値を埋め、目標・指導項目は病名から決まりやすいものを先に選んでおく（すべて直せる）

const DISEASES = ['糖尿病', '高血圧症', '脂質異常症']
const NUTRITION = ['低栄養状態の恐れ', '良好', '肥満']
const GLU_TYPES = ['空腹時', '随時', '食後']
const INTERVIEW = ['食事の状況', '運動の状況', 'たばこ', 'その他の生活']
const FOOD = [
  '食事摂取量を適正にする',
  '食塩・調味料を控える',
  '野菜・きのこ・海藻など食物繊維の摂取を増やす',
  '油を使った料理（揚げ物や炒め物等）の摂取を減らす',
  '外食の際の注意事項',
  '節酒',
  '間食を減らす',
  'ゆっくり食べる',
  '朝食・昼食・夕食を規則正しくとる',
]
const EXERCISE = ['運動処方', '日常生活の活動量増加（例：1日1万歩）', '運動時の注意事項']
const TOBACCO = ['非喫煙者である', '禁煙・節煙の有効性', '禁煙の実施方法等']
const OTHER = ['仕事', '余暇', '睡眠の確保（質・量）', '減量', '家庭での計測（歩数・体重・血圧・腹囲等）']
const MED = ['処方なし', '薬の説明']
const RESULT = ['達成', '一部達成', '未達成']
const NONE = '今回は指導の必要なし'

// 血液検査の欄（コードは labData.ts と同じ）
const LABS: { key: string; code: string; label: string; unit: string }[] = [
  { key: 'glu', code: 'GLU', label: '血糖', unit: 'mg/dL' },
  { key: 'hba1c', code: 'HBA1C', label: 'HbA1c', unit: '%' },
  { key: 'tc', code: 'TC', label: '総コレステロール', unit: 'mg/dL' },
  { key: 'tg', code: 'TG', label: '中性脂肪', unit: 'mg/dL' },
  { key: 'hdl', code: 'HDL', label: 'HDLコレステロール', unit: 'mg/dL' },
  { key: 'ldl', code: 'LDL', label: 'LDLコレステロール', unit: 'mg/dL' },
]

// 次回の見直し（概ね4か月に1回以上見直す）
const addMonths = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00`)
  t.setMonth(t.getMonth() + n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const bmiOf = (f: DocFields) => {
  const h = Number(str(f, 'height')) / 100
  const w = Number(str(f, 'weight'))
  return h > 0 && w > 0 ? (w / (h * h)).toFixed(1) : ''
}

// カルテから引ける値（Form では「カルテから」の印を出すのに使う）
const fromKarte = (p: Patient) => {
  const v = latestVitals(p)
  const labs = LABS.map((l) => [l.key, latestLab(p, l.code)] as const)
  return {
    weight: v.bw !== undefined ? String(v.bw) : '',
    sbp: v.sbp !== undefined ? String(v.sbp) : '',
    dbp: v.dbp !== undefined ? String(v.dbp) : '',
    labDate: labs.reduce((m, [, x]) => (x && x.date > m ? x.date : m), ''),
    labs: Object.fromEntries(labs.map(([k, x]) => [k, x ? String(x.value) : ''])) as Record<string, string>,
  }
}

const init = (p: Patient): DocFields => {
  const dm = hasDisease(p, /糖尿病/)
  const ht = hasDisease(p, /高血圧/)
  const dl = hasDisease(p, /脂質異常|高コレステロール|高脂血/)
  const k = fromKarte(p)
  // 降圧目標は高血圧治療ガイドライン2019の目安（75歳未満 130/80、75歳以上 140/90）。患者ごとに直す
  const bpGoal = age(p.birth) < 75 ? '130/80' : '140/90'
  // LDL の目標は一次予防の目安（糖尿病ありは120未満、それ以外は140未満）。リスクに応じて直す
  const ldlGoal = dm ? 120 : 140
  const goal = [ht && `家庭血圧 ${bpGoal} mmHg 未満`, dm && 'HbA1c 7.0% 未満', dl && `LDLコレステロール ${ldlGoal} mg/dL 未満`].filter(Boolean).join('、')
  const action = [ht && '1日の食塩を6g未満にし、朝晩に家庭血圧を測る', dm && '間食は週2回までにする', dl && '揚げ物は週1回までにする', '1日30分歩く'].filter(Boolean).join('。')
  const food = [
    dm && '食事摂取量を適正にする',
    ht && '食塩・調味料を控える',
    (dm || dl) && '野菜・きのこ・海藻など食物繊維の摂取を増やす',
    dl && '油を使った料理（揚げ物や炒め物等）の摂取を減らす',
    dm && '間食を減らす',
  ].filter(Boolean) as string[]
  // 前の計画書があれば継続用にし、前回の目標を引き継ぐ
  const prev = [...(p.docs ?? [])].filter((d) => d.kind === 'plan').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const pf = prev?.fields ?? {}
  const date = today()
  return {
    round: prev ? '継続' : '初回',
    date,
    review: addMonths(date, 4),
    diseases: [dm && '糖尿病', ht && '高血圧症', dl && '脂質異常症'].filter(Boolean) as string[],
    height: str(pf, 'height'),
    weight: k.weight,
    weightGoal: str(pf, 'weightGoal'),
    waist: '',
    waistGoal: str(pf, 'waistGoal'),
    nutrition: '',
    sbp: k.sbp,
    dbp: k.dbp,
    bpGoal: ht ? bpGoal : '',
    ecg: '',
    examOther: '',
    labDate: k.labDate,
    gluType: k.labs.glu ? '空腹時' : '',
    ...k.labs,
    labOther: '',
    interview: ['食事の状況', '運動の状況', 'たばこ'],
    goal: prev ? str(pf, 'goal') : goal,
    action: prev ? str(pf, 'action') : action,
    prevGoal: str(pf, 'goal'),
    prevAction: str(pf, 'action'),
    goalResult: '',
    actionResult: '',
    food,
    foodNote: '',
    exercise: ['運動処方', '日常生活の活動量増加（例：1日1万歩）'],
    exType: 'ウォーキング',
    exTime: '30分以上',
    exFreq: 'ほぼ毎日',
    exIntensity: '息がはずむが会話が可能な強さ',
    tobacco: [],
    other: ht ? ['家庭での計測（歩数・体重・血圧・腹囲等）'] : [],
    otherNote: '',
    med: currentRx(p).length ? '薬の説明' : '処方なし',
    problems: '',
    facilities: '',
    explained: false,
  }
}

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const k = fromKarte(patient)
  const rx = currentRx(patient)
  const t = (
    key: string,
    label: string,
    opt: {
      unit?: string
      rows?: number
      placeholder?: string
      karte?: string
      className?: string
    } = {},
  ) => (
    <Text
      key={key}
      label={label}
      value={str(f, key)}
      onChange={(v) => set({ [key]: v })}
      unit={opt.unit}
      rows={opt.rows}
      placeholder={opt.placeholder}
      className={opt.className}
      from={!!opt.karte && str(f, key) === opt.karte}
    />
  )
  const checks = (key: string, options: string[]) => <Checks value={list(f, key)} options={options} onChange={(v) => set({ [key]: v })} />
  const date = (key: string, label: string, onChange = (v: string) => set({ [key]: v })) => (
    <label className="block">
      <span className="mb-1 block text-xs text-mist">{label}</span>
      <input type="date" value={str(f, key)} onChange={(e) => onChange(e.target.value)} className="field h-8 w-full px-2 text-[0.8125rem]" />
    </label>
  )
  const cont = str(f, 'round') === '継続'

  return (
    <>
      <Section title="計画書">
        <div className="grid grid-cols-2 sm:grid-cols-3 items-end gap-2">
          <Choice label="様式" value={str(f, 'round')} options={['初回', '継続']} onChange={(v) => v && set({ round: v })} />
          {date('date', '記入日', (v) => set({ date: v, review: v ? addMonths(v, 4) : str(f, 'review') }))}
          {date('review', '次回見直し（概ね4か月後）')}
        </div>
        <Checks label="主病" value={list(f, 'diseases')} options={DISEASES} onChange={(v) => set({ diseases: v })} />
      </Section>

      <Section title="検査・問診" note="体重・血圧は直近の記載から">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {t('height', '身長', { unit: 'cm' })}
          {t('weight', '体重（現在）', { unit: 'kg', karte: k.weight })}
          {t('weightGoal', '体重（目標）', { unit: 'kg' })}
          <div>
            <span className="mb-1 block text-xs text-mist">BMI（自動）</span>
            <span className="flex h-8 items-center px-1 font-num text-[0.8125rem]">{bmiOf(f) || '—'}</span>
          </div>
          {t('waist', '腹囲（現在）', { unit: 'cm' })}
          {t('waistGoal', '腹囲（目標）', { unit: 'cm' })}
          {t('sbp', '収縮期血圧', { unit: 'mmHg', karte: k.sbp })}
          {t('dbp', '拡張期血圧', { unit: 'mmHg', karte: k.dbp })}
          {t('bpGoal', '目標血圧', { unit: 'mmHg', placeholder: '130/80' })}
        </div>
        <Choice label="栄養状態" value={str(f, 'nutrition')} options={NUTRITION} onChange={(v) => set({ nutrition: v })} />
        <div className="grid grid-cols-2 gap-2">
          {t('ecg', '運動負荷心電図')}
          {t('examOther', 'その他')}
        </div>
      </Section>

      <Section title="血液検査" note={k.labDate ? `検査結果から（${k.labDate.replace(/-/g, '/')} 採血）` : '検査結果がまだありません（手で入力できます）'}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {date('labDate', '採血日')}
          {LABS.map((l) => t(l.key, l.label, { unit: l.unit, karte: k.labs[l.key] }))}
        </div>
        <Choice label="血糖の測り方" value={str(f, 'gluType')} options={GLU_TYPES} onChange={(v) => set({ gluType: v })} />
        {t('labOther', 'その他の検査')}
        <Checks label="問診" value={list(f, 'interview')} options={INTERVIEW} onChange={(v) => set({ interview: v })} />
      </Section>

      <Section title="目標" note="患者と相談して決める">
        {cont && (
          <div className="space-y-2 rounded-md bg-cream px-3 py-2 text-xs">
            <div>
              <span className="text-mist">前回の達成目標：</span>
              {str(f, 'prevGoal') || '—'}
            </div>
            <Choice value={str(f, 'goalResult')} options={RESULT} onChange={(v) => set({ goalResult: v })} />
            <div>
              <span className="text-mist">前回の行動目標：</span>
              {str(f, 'prevAction') || '—'}
            </div>
            <Choice value={str(f, 'actionResult')} options={RESULT} onChange={(v) => set({ actionResult: v })} />
          </div>
        )}
        {t('goal', '① 達成目標', { rows: 2 })}
        {t('action', '② 行動目標', { rows: 2 })}
      </Section>

      <Section title="重点を置く領域と指導項目" note="病名から先に選んであります">
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-medium">食事</span>
            {checks('food', [NONE, ...FOOD])}
            {t('foodNote', '外食・節酒・間食などの具体的な内容', {
              className: 'mt-1.5',
              placeholder: '例：ビールは週3回・1回350mLまで',
            })}
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium">運動</span>
            {checks('exercise', [NONE, ...EXERCISE])}
            {list(f, 'exercise').includes('運動処方') && (
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {t('exType', '種類')}
                {t('exTime', '時間')}
                {t('exFreq', '頻度')}
                {t('exIntensity', '強度')}
              </div>
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium">たばこ</span>
            {checks('tobacco', TOBACCO)}
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium">その他</span>
            {checks('other', OTHER)}
            {t('otherNote', 'その他の内容', { className: 'mt-1.5' })}
          </div>
        </div>
      </Section>

      <Section title="服薬指導・そのほか">
        <Choice value={str(f, 'med')} options={MED} onChange={(v) => set({ med: v })} />
        {str(f, 'med') === '薬の説明' && rx.length > 0 && (
          <ul className="space-y-0.5 rounded-md bg-cream px-3 py-2 text-xs text-mist">
            {rx.map((r) => (
              <li key={r.id}>{rxLine(r)}</li>
            ))}
          </ul>
        )}
        {t('problems', '療養を行うにあたっての問題点', { rows: 2 })}
        {t('facilities', '他の施設の利用状況', {
          rows: 2,
          placeholder: '例：〇〇眼科で年1回の眼底検査',
        })}
        {/* 2024年改定の様式：説明して理解を確認したことを担当医がチェックすれば患者署名を省略できる、として作った（TODO：2026改定で要確認） */}
        <label className="flex items-start gap-2 rounded-md border border-line px-3 py-2 text-[0.8125rem]">
          <input type="checkbox" checked={bool(f, 'explained')} onChange={(e) => set({ explained: e.target.checked })} className="mt-0.5 h-4 w-4 accent-clinical" />
          <span>
            患者が療養計画書の内容について説明を受け、十分に理解したことを確認した
            <span className="block text-[0.6875rem] text-mist">チェックすると患者署名欄は「省略」と印刷されます</span>
          </span>
        </label>
      </Section>
    </>
  )
}

// ---- 印刷面（A4・1枚）。この様式は字が多いので、表の文字は小さめにして1枚に収める ----

function R({ th, children, thW = '24mm' }: { th: React.ReactNode; children?: React.ReactNode; thW?: string }) {
  return (
    <div className="flex border-b border-black last:border-b-0">
      <div className="flex shrink-0 items-center border-r border-black bg-[#f2f2f2] px-[1.5mm] py-[1mm] text-[8pt] leading-tight" style={{ width: thW }}>
        {th}
      </div>
      <div className="min-w-0 flex-1 px-[1.5mm] py-[1mm] whitespace-pre-wrap">{children}</div>
    </div>
  )
}

// 値に下線（空なら空白の線）
const U = ({ v, w = '12mm' }: { v: string; w?: string }) => (
  <span className="inline-block border-b border-black text-center" style={{ minWidth: w }}>
    {v || ' '}
  </span>
)

const Head = ({ children }: { children: React.ReactNode }) => <div className="border-b border-black bg-[#e6e6e6] px-[1.5mm] py-[0.4mm] text-[8.5pt] font-bold">{children}</div>

// その領域で何か選んでいれば見出しも■
const area = (f: DocFields, key: string) => list(f, key).length > 0
const md = (d: string) => (d ? `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日` : '　月　日')

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const cont = str(f, 'round') === '継続'
  const ex = list(f, 'exercise')
  return (
    <Paper className="py-[12mm]! text-[9pt]! leading-[1.45]!">
      <div className="flex items-end justify-between text-[8pt]">
        <span>{cont ? '（別紙様式9の2）' : '（別紙様式9）'}</span>
        <span>（記入日：{wareki(str(f, 'date'))}）</span>
      </div>
      <h1 className="mt-[1mm] mb-[2mm] text-center text-[14pt] font-bold tracking-[0.15em]">
        生活習慣病 療養計画書　
        <span className="text-[11pt] tracking-normal">{cont ? '継続用' : '初回用'}</span>
      </h1>

      <div className="border border-black">
        <R th="患者氏名">
          <span className="flex flex-wrap items-baseline gap-x-[4mm]">
            <span className="text-[11pt]">{patient.name}</span>
            <span>
              （<Boxes options={['男', '女']} value={patient.sex} />）
            </span>
            <span>
              生年月日：{birthLabel(patient.birth)}生（{age(patient.birth)}才）
            </span>
          </span>
        </R>
        <R th="主病">
          <Boxes options={DISEASES} value={list(f, 'diseases')} />
        </R>
        <R th="ねらい">
          {cont
            ? '重点目標の達成状況を理解できること・目標再設定と指導された生活習慣改善に取り組めること'
            : '検査結果を理解できること・自分の生活上の問題点を抽出し、目標を設定できること'}
        </R>
      </div>

      <div className="mt-[1.5mm] border border-black">
        <Head>【検査・問診】</Head>
        <div className="flex">
          <div className="w-1/2 border-r border-black">
            <R th="身長">
              <U v={str(f, 'height')} /> cm
            </R>
            <R th="体重">
              現在 <U v={str(f, 'weight')} /> kg → 目標 <U v={str(f, 'weightGoal')} /> kg
            </R>
            <R th="BMI">
              <U v={bmiOf(f)} />
            </R>
            <R th="腹囲">
              現在 <U v={str(f, 'waist')} /> cm → 目標 <U v={str(f, 'waistGoal')} /> cm
            </R>
            <R th="栄養状態">
              <Boxes options={NUTRITION} value={str(f, 'nutrition')} />
            </R>
            <R th="血圧">
              <U v={str(f, 'sbp')} w="10mm" /> / <U v={str(f, 'dbp')} w="10mm" /> mmHg
              {str(f, 'bpGoal') && <span className="ml-[1.5mm] text-[8pt] whitespace-nowrap">（目標{str(f, 'bpGoal')}未満）</span>}
            </R>
            <R th="運動負荷心電図">{str(f, 'ecg')}</R>
            <R th="その他">{str(f, 'examOther')}</R>
          </div>
          <div className="w-1/2">
            <R th="【血液検査】" thW="31mm">
              採血日 {md(str(f, 'labDate'))}
            </R>
            <R th={`${box(!!str(f, 'glu'))}血糖`} thW="31mm">
              <span className="text-[7.5pt]">
                <Boxes options={GLU_TYPES} value={str(f, 'gluType')} />
              </span>{' '}
              <U v={str(f, 'glu')} w="9mm" /> mg/dL
            </R>
            {LABS.slice(1).map((l) => (
              <R key={l.key} th={`${box(!!str(f, l.key))}${l.label}`} thW="31mm">
                <U v={str(f, l.key)} /> {l.unit}
              </R>
            ))}
            <R th="その他" thW="31mm">
              {str(f, 'labOther')}
            </R>
          </div>
        </div>
        <div className="border-t border-black">
          <R th="【問診】">
            <Boxes options={INTERVIEW} value={list(f, 'interview')} />
          </R>
        </div>
      </div>

      <div className="mt-[1.5mm] border border-black">
        {cont && (
          <R th="前回の目標の達成状況">
            <div>
              達成目標：{str(f, 'prevGoal') || '—'}　
              <Boxes options={RESULT} value={str(f, 'goalResult')} />
            </div>
            <div>
              行動目標：{str(f, 'prevAction') || '—'}　
              <Boxes options={RESULT} value={str(f, 'actionResult')} />
            </div>
          </R>
        )}
        <R
          th={
            <span>
              【①達成目標】
              <br />
              患者と相談した目標
            </span>
          }
        >
          <div className="min-h-[10mm]">{str(f, 'goal')}</div>
        </R>
        <R
          th={
            <span>
              【②行動目標】
              <br />
              患者と相談した目標
            </span>
          }
        >
          <div className="min-h-[10mm]">{str(f, 'action')}</div>
        </R>
      </div>

      <div className="mt-[1.5mm] border border-black">
        <Head>【重点を置く領域と指導項目】</Head>
        <R th={`${box(area(f, 'food'))}食事`} thW="16mm">
          <Boxes options={[NONE, ...FOOD]} value={list(f, 'food')} />
          {str(f, 'foodNote') && <div>（{str(f, 'foodNote')}）</div>}
        </R>
        <R th={`${box(area(f, 'exercise'))}運動`} thW="16mm">
          <Boxes options={[NONE, ...EXERCISE]} value={ex} />
          {ex.includes('運動処方') && (
            <div>
              運動処方：種類（{str(f, 'exType')}）・時間（{str(f, 'exTime')}
              ）・頻度（{str(f, 'exFreq')}）・強度（{str(f, 'exIntensity')}）
            </div>
          )}
        </R>
        <R th={`${box(area(f, 'tobacco'))}たばこ`} thW="16mm">
          <Boxes options={TOBACCO} value={list(f, 'tobacco')} />
        </R>
        <R th={`${box(area(f, 'other'))}その他`} thW="16mm">
          <Boxes options={OTHER} value={list(f, 'other')} />
          {str(f, 'otherNote') && <div>（{str(f, 'otherNote')}）</div>}
        </R>
      </div>

      <div className="mt-[1.5mm] border border-black">
        <R th="【服薬指導】" thW="34mm">
          <Boxes options={MED} value={str(f, 'med')} />
        </R>
        <R th="【療養を行うにあたっての問題点】" thW="34mm">
          <div className="min-h-[9mm]">{str(f, 'problems')}</div>
        </R>
        <R th="【他の施設の利用状況について】" thW="34mm">
          <div className="min-h-[9mm]">{str(f, 'facilities')}</div>
        </R>
      </div>

      <div className="mt-[2mm] text-[8pt]">
        {box(bool(f, 'explained'))} 患者が療養計画書の内容について説明を受けた上で十分に理解したことを確認した。
        <span className="text-[7.5pt]">（なお、上記項目に担当医がチェックした場合については患者署名を省略して差し支えない）</span>
      </div>
      <div className="mt-[2.5mm] flex items-end gap-[8mm] text-[9pt]">
        <div className="flex-1">
          <div className="text-[8pt]">次回の見直し予定：{wareki(str(f, 'review'))}ごろ</div>
          <div className="mt-[2.5mm] flex items-end gap-[2mm]">
            患者署名
            <span className="inline-block flex-1 border-b border-black pb-[0.5mm] text-center text-[8pt] text-[#555]">
              {bool(f, 'explained') ? '（説明と理解の確認により省略）' : ' '}
            </span>
          </div>
        </div>
        <div className="w-[82mm]">
          <div className="text-[8pt]">{CLINIC.name}</div>
          <div className="mt-[1mm] flex items-end gap-[2mm]">
            医師氏名
            <span className="inline-block flex-1 border-b border-black pb-[0.5mm] text-center text-[11pt]">{CLINIC.doctor}</span>
            <span className="inline-flex h-[8mm] w-[8mm] shrink-0 items-center justify-center rounded-full border border-[#c33] text-[7pt] text-[#c33]">印</span>
          </div>
        </div>
      </div>
    </Paper>
  )
}

export const planDoc: DocDef = {
  kind: 'plan',
  title: '生活習慣病 療養計画書',
  icon: 'assignment',
  desc: '高血圧・脂質異常症・糖尿病。初回／継続、カルテから自動入力',
  group: '計画書',
  init,
  Form,
  Sheet,
}
