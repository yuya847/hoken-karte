// 試作用の架空データ。実在の患者・医療機関とは無関係。
import type { Disease, Encounter, Patient, RxItem, TestOrder } from './types'

export type Drug = {
  id: string
  name: string
  kana: string
  alias: string
  unit: string
  dose: number
  usage: string
  days: number
}

export const DRUGS: Drug[] = [
  { id: 'd01', name: 'アムロジピン錠5mg', kana: 'あむろじぴん', alias: 'amlo', unit: '錠', dose: 1, usage: '1日1回朝食後', days: 28 },
  { id: 'd02', name: 'オルメサルタン錠20mg', kana: 'おるめさるたん', alias: 'olme', unit: '錠', dose: 1, usage: '1日1回朝食後', days: 28 },
  { id: 'd03', name: 'メトホルミン錠250mg', kana: 'めとほるみん', alias: 'metfo', unit: '錠', dose: 4, usage: '1日2回朝夕食後', days: 28 },
  { id: 'd04', name: 'シタグリプチン錠50mg', kana: 'したぐりぷちん', alias: 'sita', unit: '錠', dose: 1, usage: '1日1回朝食後', days: 28 },
  { id: 'd05', name: 'ロスバスタチン錠2.5mg', kana: 'ろすばすたちん', alias: 'rosu', unit: '錠', dose: 1, usage: '1日1回夕食後', days: 28 },
  { id: 'd06', name: 'アトルバスタチン錠10mg', kana: 'あとるばすたちん', alias: 'ator', unit: '錠', dose: 1, usage: '1日1回夕食後', days: 28 },
  { id: 'd07', name: 'ランソプラゾールOD錠15mg', kana: 'らんそぷらぞーる', alias: 'lanso', unit: '錠', dose: 1, usage: '1日1回朝食後', days: 28 },
  { id: 'd08', name: 'レバミピド錠100mg', kana: 'ればみぴど', alias: 'reba', unit: '錠', dose: 3, usage: '1日3回毎食後', days: 14 },
  { id: 'd09', name: 'カルボシステイン錠500mg', kana: 'かるぼしすていん', alias: 'karubo', unit: '錠', dose: 3, usage: '1日3回毎食後', days: 5 },
  { id: 'd10', name: 'アセトアミノフェン錠200mg', kana: 'あせとあみのふぇん', alias: 'aseto', unit: '錠', dose: 2, usage: '発熱・疼痛時', days: 5 },
  { id: 'd11', name: 'ロキソプロフェン錠60mg', kana: 'ろきそぷろふぇん', alias: 'loxo', unit: '錠', dose: 3, usage: '1日3回毎食後', days: 5 },
  { id: 'd12', name: 'モンテルカスト錠10mg', kana: 'もんてるかすと', alias: 'monte', unit: '錠', dose: 1, usage: '1日1回就寝前', days: 28 },
  { id: 'd13', name: 'フェキソフェナジン錠60mg', kana: 'ふぇきそふぇなじん', alias: 'feki', unit: '錠', dose: 2, usage: '1日2回朝夕食後', days: 14 },
  { id: 'd14', name: '酸化マグネシウム錠330mg', kana: 'さんかまぐねしうむ', alias: 'mag', unit: '錠', dose: 3, usage: '1日3回毎食後', days: 28 },
  { id: 'd15', name: 'フェブキソスタット錠20mg', kana: 'ふぇぶきそすたっと', alias: 'febu', unit: '錠', dose: 1, usage: '1日1回朝食後', days: 28 },
]

export const TEST_GROUPS = ['血液学', '生化学', '免疫・血清', '尿・便', '生理', '画像'] as const
export type TestGroup = (typeof TEST_GROUPS)[number]

export const TESTS: { code: string; name: string; kana: string; alias: string; group: TestGroup }[] = [
  { code: 't01', name: '血算（CBC）', kana: 'けっさん', alias: 'cbc', group: '血液学' },
  { code: 't09', name: '白血球分画', kana: 'はっけっきゅうぶんかく', alias: 'diff', group: '血液学' },
  { code: 't02', name: 'HbA1c', kana: 'へもぐろびんえーわんしー', alias: 'a1c', group: '血液学' },
  { code: 't10', name: 'PT-INR', kana: 'ぷろとろんびんじかん', alias: 'inr', group: '血液学' },
  { code: 't11', name: 'D-ダイマー', kana: 'でぃーだいまー', alias: 'dd', group: '血液学' },
  { code: 't03', name: '生化学（肝・腎・脂質）', kana: 'せいかがく', alias: 'seika', group: '生化学' },
  { code: 't12', name: 'AST・ALT・γ-GTP', kana: 'かんきのう', alias: 'ast alt ggt', group: '生化学' },
  { code: 't13', name: 'BUN・Cre・eGFR', kana: 'じんきのう', alias: 'bun cre egfr', group: '生化学' },
  { code: 't14', name: '尿酸', kana: 'にょうさん', alias: 'ua', group: '生化学' },
  { code: 't15', name: 'Na・K・Cl', kana: 'でんかいしつ', alias: 'na k cl', group: '生化学' },
  { code: 't16', name: 'TC・TG・HDL・LDL', kana: 'ししつ', alias: 'tc tg hdl ldl', group: '生化学' },
  { code: 't17', name: '血糖', kana: 'けっとう', alias: 'bs glu', group: '生化学' },
  { code: 't18', name: 'CK', kana: 'しーけー', alias: 'ck cpk', group: '生化学' },
  { code: 't04', name: 'CRP', kana: 'しーあーるぴー', alias: 'crp', group: '免疫・血清' },
  { code: 't19', name: 'BNP', kana: 'びーえぬぴー', alias: 'bnp', group: '免疫・血清' },
  { code: 't20', name: 'TSH・FT4', kana: 'こうじょうせん', alias: 'tsh ft4', group: '免疫・血清' },
  { code: 't21', name: 'HBs抗原・HCV抗体', kana: 'かんえん', alias: 'hbs hcv', group: '免疫・血清' },
  { code: 't22', name: 'PSA', kana: 'ぴーえすえー', alias: 'psa', group: '免疫・血清' },
  { code: 't08', name: 'インフルエンザ抗原', kana: 'いんふるえんざ', alias: 'flu', group: '免疫・血清' },
  { code: 't23', name: 'SARS-CoV-2抗原', kana: 'ころな', alias: 'covid', group: '免疫・血清' },
  { code: 't05', name: '尿一般', kana: 'にょういっぱん', alias: 'nyo', group: '尿・便' },
  { code: 't24', name: '尿沈渣', kana: 'にょうちんさ', alias: 'chinsa', group: '尿・便' },
  { code: 't25', name: '尿中アルブミン', kana: 'にょうちゅうあるぶみん', alias: 'ualb', group: '尿・便' },
  { code: 't26', name: '便潜血（2回法）', kana: 'べんせんけつ', alias: 'fobt', group: '尿・便' },
  { code: 't06', name: '心電図（12誘導）', kana: 'しんでんず', alias: 'ecg', group: '生理' },
  { code: 't27', name: 'ABI', kana: 'えーびーあい', alias: 'abi', group: '生理' },
  { code: 't28', name: '呼吸機能検査', kana: 'こきゅうきのう', alias: 'spiro', group: '生理' },
  { code: 't29', name: '腹部超音波', kana: 'ふくぶえこー', alias: 'us echo', group: '生理' },
  { code: 't07', name: '胸部X線', kana: 'きょうぶえっくすせん', alias: 'xp', group: '画像' },
  { code: 't30', name: '腹部X線', kana: 'ふくぶえっくすせん', alias: 'axr', group: '画像' },
]

export const DISEASES: { name: string; kana: string; alias: string }[] = [
  { name: '高血圧症', kana: 'こうけつあつしょう', alias: 'ht' },
  { name: '2型糖尿病', kana: 'にがたとうにょうびょう', alias: 'dm' },
  { name: '脂質異常症', kana: 'ししついじょうしょう', alias: 'dl' },
  { name: '逆流性食道炎', kana: 'ぎゃくりゅうせいしょくどうえん', alias: 'gerd' },
  { name: '急性上気道炎', kana: 'きゅうせいじょうきどうえん', alias: 'uri' },
  { name: '気管支喘息', kana: 'きかんしぜんそく', alias: 'ba' },
  { name: 'アレルギー性鼻炎', kana: 'あれるぎーせいびえん', alias: 'ar' },
  { name: '便秘症', kana: 'べんぴしょう', alias: 'benpi' },
  { name: '高尿酸血症', kana: 'こうにょうさんけっしょう', alias: 'hu' },
  { name: '急性胃炎', kana: 'きゅうせいいえん', alias: 'agml' },
  { name: '慢性胃炎', kana: 'まんせいいえん', alias: 'cg' },
  { name: '急性気管支炎', kana: 'きゅうせいきかんしえん', alias: 'ab' },
  { name: '頭痛', kana: 'ずつう', alias: 'ha' },
  { name: '腰痛症', kana: 'ようつうしょう', alias: 'lbp' },
  { name: '貧血', kana: 'ひんけつ', alias: 'anemia' },
  { name: '肝機能障害', kana: 'かんきのうしょうがい', alias: 'liver' },
  { name: '脂肪肝', kana: 'しぼうかん', alias: 'nafld' },
  { name: '慢性腎臓病', kana: 'まんせいじんぞうびょう', alias: 'ckd' },
  { name: '心不全', kana: 'しんふぜん', alias: 'hf chf' },
  { name: '心房細動', kana: 'しんぼうさいどう', alias: 'af' },
  { name: '不整脈', kana: 'ふせいみゃく', alias: 'arrhythmia' },
  { name: '深部静脈血栓症', kana: 'しんぶじょうみゃくけっせんしょう', alias: 'dvt' },
  { name: '甲状腺機能低下症', kana: 'こうじょうせんきのうていかしょう', alias: 'hypothyroid' },
  { name: '肺炎', kana: 'はいえん', alias: 'pneumonia' },
  { name: 'インフルエンザ', kana: 'いんふるえんざ', alias: 'flu' },
  { name: 'COVID-19', kana: 'ころな', alias: 'covid' },
  { name: '前立腺癌', kana: 'ぜんりつせんがん', alias: 'pca' },
  { name: '大腸癌', kana: 'だいちょうがん', alias: 'crc' },
  { name: '末梢動脈疾患', kana: 'まっしょうどうみゃくしっかん', alias: 'pad' },
  { name: '慢性閉塞性肺疾患', kana: 'まんせいへいそくせいはいしっかん', alias: 'copd' },
]

// 適応病名の簡易対応表（試作用）。正式な適応・算定要件はPhase 3で医薬品・診療行為マスタから引く。
// 処方は確定病名にだけ紐付け、検査は「疑い」病名にも紐付ける。
export const DRUG_INDICATIONS: Record<string, string[]> = {
  d01: ['高血圧症'],
  d02: ['高血圧症'],
  d03: ['2型糖尿病'],
  d04: ['2型糖尿病'],
  d05: ['脂質異常症'],
  d06: ['脂質異常症'],
  d07: ['逆流性食道炎'],
  d08: ['急性胃炎', '慢性胃炎'],
  d09: ['急性上気道炎', '急性気管支炎'],
  d10: ['急性上気道炎', '頭痛', '腰痛症'],
  d11: ['腰痛症', '頭痛', '急性上気道炎'],
  d12: ['気管支喘息', 'アレルギー性鼻炎'],
  d13: ['アレルギー性鼻炎'],
  d14: ['便秘症'],
  d15: ['高尿酸血症'],
}

export const TEST_INDICATIONS: Record<string, string[]> = {
  t01: ['貧血', '急性上気道炎', '肺炎'],
  t09: ['肺炎', '急性上気道炎'],
  t02: ['2型糖尿病'],
  t10: ['心房細動', '深部静脈血栓症'],
  t11: ['深部静脈血栓症'],
  t03: ['脂質異常症', '2型糖尿病', '高血圧症', '肝機能障害', '慢性腎臓病'],
  t12: ['肝機能障害', '脂肪肝', '脂質異常症'],
  t13: ['慢性腎臓病', '高血圧症', '2型糖尿病'],
  t14: ['高尿酸血症'],
  t15: ['高血圧症', '慢性腎臓病'],
  t16: ['脂質異常症'],
  t17: ['2型糖尿病'],
  t18: ['脂質異常症'],
  t04: ['急性上気道炎', '肺炎', '急性気管支炎'],
  t19: ['心不全'],
  t20: ['甲状腺機能低下症'],
  t21: ['肝機能障害'],
  t22: ['前立腺癌'],
  t08: ['インフルエンザ'],
  t23: ['COVID-19'],
  t05: ['2型糖尿病', '慢性腎臓病', '高血圧症'],
  t24: ['慢性腎臓病'],
  t25: ['2型糖尿病', '慢性腎臓病'],
  t26: ['大腸癌'],
  t06: ['高血圧症', '不整脈', '心房細動'],
  t27: ['末梢動脈疾患'],
  t28: ['気管支喘息', '慢性閉塞性肺疾患'],
  t29: ['脂肪肝', '肝機能障害'],
  t07: ['肺炎', '心不全'],
  t30: ['便秘症'],
}

export type OrderSet = { id: string; name: string; kana: string; alias: string; drugs: string[]; tests: string[]; disease?: string }

export const SETS: OrderSet[] = [
  { id: 's1', name: '感冒セット', kana: 'かんぼう', alias: 'kaze', drugs: ['d09', 'd10'], tests: [], disease: '急性上気道炎' },
  { id: 's2', name: '糖尿病 定期検査セット', kana: 'とうにょうびょう', alias: 'dmset', drugs: [], tests: ['t02', 't03', 't05'] },
  { id: 's3', name: '年1回 生活習慣病検査セット', kana: 'せいかつしゅうかん', alias: 'yearly', drugs: [], tests: ['t01', 't03', 't05', 't06'] },
]

let seq = 0
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => ymd(new Date())

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymd(d)
}

export const rxFromDrug = (drugId: string, days?: number): RxItem => {
  const d = DRUGS.find((x) => x.id === drugId)!
  return { id: uid('rx'), drugId: d.id, name: d.name, dose: d.dose, unit: d.unit, usage: d.usage, days: days ?? d.days }
}

export const testFromCode = (code: string): TestOrder => {
  const t = TESTS.find((x) => x.code === code)!
  return { id: uid('t'), code: t.code, name: t.name }
}

const enc = (n: number, partial: Partial<Encounter>): Encounter => ({
  id: uid('enc'),
  date: daysAgo(n),
  kind: '再診',
  vitals: {},
  text: '',
  rx: [],
  tests: [],
  letters: [],
  version: 1,
  history: [],
  ...partial,
})

const dis = (name: string, start: string, main = false): Disease => ({ id: uid('dis'), name, start, main, status: '継続' })

export const initialPatients = (): Patient[] => [
  {
    id: 'p1',
    name: '山田 太郎',
    kana: 'ヤマダ タロウ',
    sex: '男',
    birth: '1957-04-12',
    insurance: '協会けんぽ 本人',
    burden: 0.3,
    allergies: ['ペニシリン系（発疹）'],
    status: '待ち',
    diseases: [dis('高血圧症', '2019-05-10', true), dis('2型糖尿病', '2021-02-03'), dis('脂質異常症', '2021-02-03')],
    encounters: [
      enc(84, {
        vitals: { sbp: 142, dbp: 86, hr: 74, bw: 71.2 },
        text: '血圧やや高め。家庭血圧 135/85前後。減塩を継続指導。\nHbA1c 7.2%。食事療法の振り返り。',
        rx: [rxFromDrug('d01'), rxFromDrug('d03'), rxFromDrug('d05')],
        tests: [testFromCode('t02'), testFromCode('t03')],
      }),
      enc(56, {
        vitals: { sbp: 136, dbp: 82, hr: 70, bw: 70.5 },
        text: '家庭血圧 130/80台に改善。体重 -0.7kg。\n自覚症状なし。Do処方。',
        rx: [rxFromDrug('d01'), rxFromDrug('d03'), rxFromDrug('d05')],
      }),
      enc(28, {
        vitals: { sbp: 134, dbp: 80, hr: 72, bw: 70.1 },
        text: '著変なし。足のしびれなし。眼科受診は来月予定とのこと。\nDo処方。',
        rx: [rxFromDrug('d01'), rxFromDrug('d03'), rxFromDrug('d05')],
      }),
    ],
  },
  {
    id: 'p2',
    name: '佐藤 花子',
    kana: 'サトウ ハナコ',
    sex: '女',
    birth: '1980-09-30',
    insurance: '組合健保 家族',
    burden: 0.3,
    allergies: [],
    status: '待ち',
    diseases: [dis('逆流性食道炎', '2025-11-20', true)],
    encounters: [
      enc(42, {
        vitals: { sbp: 118, dbp: 72, hr: 68 },
        text: '胸やけは週1回程度に減少。夜間の症状なし。',
        rx: [rxFromDrug('d07')],
      }),
    ],
  },
  {
    id: 'p3',
    name: '鈴木 一郎',
    kana: 'スズキ イチロウ',
    sex: '男',
    birth: '1994-01-18',
    insurance: '国保',
    burden: 0.3,
    allergies: [],
    status: '待ち',
    diseases: [],
    encounters: [],
  },
  {
    id: 'p4',
    name: '高橋 美咲',
    kana: 'タカハシ ミサキ',
    sex: '女',
    birth: '1971-06-05',
    insurance: '協会けんぽ 本人',
    burden: 0.3,
    allergies: ['ロキソプロフェン（喘息様症状）'],
    status: '待ち',
    diseases: [dis('高血圧症', '2022-08-01', true), dis('気管支喘息', '2015-04-01')],
    encounters: [
      enc(30, {
        vitals: { sbp: 128, dbp: 78, hr: 76, spo2: 98 },
        text: '喘息発作なし。吸入手技良好。血圧安定。',
        rx: [rxFromDrug('d02'), rxFromDrug('d12')],
      }),
    ],
  },
  {
    id: 'p5',
    name: '田中 健',
    kana: 'タナカ ケン',
    sex: '男',
    birth: '1951-12-24',
    insurance: '後期高齢者',
    burden: 0.1,
    allergies: [],
    status: '待ち',
    diseases: [dis('2型糖尿病', '2012-03-14', true), dis('高尿酸血症', '2018-07-09'), dis('便秘症', '2023-01-20')],
    encounters: [
      enc(91, {
        vitals: { sbp: 138, dbp: 76, bw: 62.0 },
        text: 'HbA1c 7.8%。間食が増えていた。食事内容を確認。',
        rx: [rxFromDrug('d03'), rxFromDrug('d04'), rxFromDrug('d15'), rxFromDrug('d14')],
        tests: [testFromCode('t02'), testFromCode('t03'), testFromCode('t05')],
      }),
      enc(35, {
        vitals: { sbp: 132, dbp: 74, bw: 61.4 },
        text: '間食を減らせている。便通良好。',
        rx: [rxFromDrug('d03'), rxFromDrug('d04'), rxFromDrug('d15'), rxFromDrug('d14')],
      }),
    ],
  },
]

export const age = (birth: string) => {
  const b = new Date(birth)
  const n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a
}
