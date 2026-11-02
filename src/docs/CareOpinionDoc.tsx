import { CLINIC, age, today } from '../data'
import { Icon } from '../Icon'
import { activeDiseases, byDateDesc, currentRx, latestVitals } from '../karte'
import { birthLabel } from '../PatientIcon'
import { Paper } from '../print'
import { rxLine } from '../rxFormat'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Boxes, Checks, Choice, Row, Section, Table, Text, list, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 介護保険の主治医意見書（厚労省の様式に合わせた2ページ）。
// 病名・発症日・処方・最終診察日・体重はカルテから埋める。前回の意見書があれば複製できる（記入日・最終診察日は今回のまま）

const APP_TYPES = ['新規', '区分変更', '更新']
const COUNTS = ['初回', '2回目以上']
const DEPTS = ['内科', '精神科', '外科', '整形外科', '脳神経外科', '皮膚科', '泌尿器科', '婦人科', '眼科', '耳鼻咽喉科', 'リハビリテーション科', '歯科', 'その他']
const STABILITY = ['安定', '不安定', '不明']
const TREAT = ['点滴の管理', '中心静脈栄養', '透析', 'ストーマの処置', '酸素療法', 'レスピレーター', '気管切開の処置', '疼痛の看護', '経管栄養']
const SPECIAL = ['モニター測定（血圧・心拍・酸素飽和度等）', '褥瘡の処置']
const INCONT = ['カテーテル（コンドームカテーテル・留置カテーテル等）']
const BEDRIDDEN = ['自立', 'J1', 'J2', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const DEMENTIA = ['自立', 'Ⅰ', 'Ⅱa', 'Ⅱb', 'Ⅲa', 'Ⅲb', 'Ⅳ', 'M']
const MEMORY = ['問題なし', '問題あり']
const DECISION = ['自立', 'いくらか困難', '見守りが必要', '判断できない']
const COMMUNICATE = ['伝えられる', 'いくらか困難', '具体的要求に限られる', '伝えられない']
const NOYES = ['無', '有']
const BPSD = ['幻視・幻聴', '妄想', '昼夜逆転', '暴言', '暴行', '介護への抵抗', '徘徊', '火の不始末', '不潔行為', '異食行動', '性的問題行動', 'その他']
const HAND = ['右', '左']
const WEIGHT_TREND = ['増加', '維持', '減少']
const BODY = ['四肢欠損', '麻痺', '筋力の低下', '関節の拘縮', '関節の痛み', '失調・不随意運動', '褥瘡', 'その他の皮膚疾患']
const OUTDOOR = ['自立', '介助があればしている', 'していない']
const WHEELCHAIR = ['用いていない', '主に自分で操作している', '主に他人が操作している']
const AIDS = ['用いていない', '屋外で使用', '屋内で使用']
const MEAL = ['自立ないし何とか自分で食べられる', '全面介助']
const NUTRITION = ['良好', '不良']
const RISKS = ['尿失禁', '転倒・骨折', '移動能力の低下', '褥瘡', '心肺機能の低下', '閉じこもり', '意欲低下', '徘徊', '低栄養', '摂食・嚥下機能低下', '脱水', '易感染性', 'がん等による疼痛', 'その他']
const OUTLOOK = ['期待できる', '期待できない', '不明']
const NEEDS = ['訪問診療', '訪問看護', '訪問歯科診療', '訪問薬剤管理指導', '訪問リハビリテーション', '短期入所療養介護', '訪問歯科衛生指導', '訪問栄養食事指導', '通所リハビリテーション', '老人保健施設', '介護医療院', 'その他の医療系サービス']
const CAUTIONS: [string, string][] = [
  ['cBp', '血圧'],
  ['cEat', '摂食'],
  ['cSwallow', '嚥下'],
  ['cMove', '移動'],
  ['cExercise', '運動'],
  ['cOther', 'その他'],
]
const INFECTION = ['無', '有', '不明']
const CONSENT = ['同意する', '同意しない']

const init = (p: Patient): DocFields => {
  // 疑い病名は書かない。主病名を先頭に
  const dx = activeDiseases(p)
    .filter((d) => !d.suspected)
    .sort((a, b) => Number(b.main) - Number(a.main))
  const last = byDateDesc(p.encounters)[0]
  const prev = p.docs?.some((d) => d.kind === 'careOpinion')
  const rx = currentRx(p)
  const v = latestVitals(p)
  return {
    date: today(),
    appType: p.careLevel ? '更新' : '新規',
    consent: '同意する',
    lastVisit: last?.date ?? '',
    count: prev || p.careLevel ? '2回目以上' : '初回',
    otherDept: '無',
    otherDepts: [],
    dx1: dx[0]?.name ?? '',
    dx1Date: dx[0]?.start ?? '',
    dx2: dx[1]?.name ?? '',
    dx2Date: dx[1]?.start ?? '',
    dx3: dx[2]?.name ?? '',
    dx3Date: dx[2]?.start ?? '',
    stability: '安定',
    stabilityNote: '',
    course: [
      dx.length ? `${dx.map((d) => d.name).join('、')}にて当院通院中。` : '',
      last?.text ? `直近の所見：${last.text.split('\n')[0]}` : '',
      rx.length ? `【投薬内容】\n${rx.map((r) => `・${rxLine(r)}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    treat: [],
    special: [],
    incont: [],
    bedridden: '',
    dementia: '自立',
    memory: '問題なし',
    decision: '自立',
    communicate: '伝えられる',
    bpsd: '無',
    bpsdList: [],
    psych: '無',
    psychNote: '',
    hand: '右',
    height: '',
    weight: v.bw ? String(v.bw) : '',
    weightTrend: '維持',
    body: [],
    bodyNote: '',
    outdoor: '自立',
    wheelchair: '用いていない',
    aids: ['用いていない'],
    meal: '自立ないし何とか自分で食べられる',
    nutrition: '良好',
    nutritionNote: '',
    risks: [],
    riskPlan: '',
    outlook: '期待できる',
    needs: [],
    cBp: '',
    cEat: '',
    cSwallow: '',
    cMove: '',
    cExercise: '',
    cOther: '',
    infection: '無',
    infectionNote: '',
    notes: '',
  }
}

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const s = (k: string) => (v: string) => set({ [k]: v })
  const l = (k: string) => (v: string[]) => set({ [k]: v })
  const prev = (patient.docs ?? []).filter((d) => d.kind === 'careOpinion' && d.id !== doc.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  // カルテから埋めた値のままなら「カルテから」の印
  const auto = init(patient)
  const fromK = (k: string) => !!str(auto, k) && str(f, k) === str(auto, k)

  return (
    <>
      {prev && (
        <button
          type="button"
          onClick={() => set({ ...prev.fields, date: str(f, 'date'), lastVisit: str(f, 'lastVisit'), count: '2回目以上' })}
          title="前回の内容を写します（記入日・最終診察日は今回のまま）"
          className="btn btn-sm btn-tonal"
        >
          <Icon name="content_copy" size={18} />
          前回の意見書を複製（{prev.createdAt.replace(/-/g, '/')}）
        </button>
      )}
      <Section title="基本">
        <div className="grid grid-cols-2 gap-2.5">
          <Text label="記入日" value={str(f, 'date')} onChange={s('date')} placeholder="YYYY-MM-DD" />
          <Text label="最終診察日" value={str(f, 'lastVisit')} onChange={s('lastVisit')} from={fromK('lastVisit')} placeholder="YYYY-MM-DD" />
        </div>
        <Choice label={`申請区分${patient.careLevel ? `（現在 ${patient.careLevel}）` : ''}`} value={str(f, 'appType')} options={APP_TYPES} onChange={s('appType')} />
        <Choice label="意見書作成回数" value={str(f, 'count')} options={COUNTS} onChange={s('count')} />
        <Choice label="介護サービス計画作成等への利用" value={str(f, 'consent')} options={CONSENT} onChange={s('consent')} />
        <Choice label="他科受診の有無" value={str(f, 'otherDept')} options={NOYES} onChange={s('otherDept')} />
        {str(f, 'otherDept') === '有' && <Checks value={list(f, 'otherDepts')} options={DEPTS} onChange={l('otherDepts')} />}
      </Section>

      <Section title="1. 傷病に関する意見" note="生活機能低下の直接の原因になっている順に">
        {[1, 2, 3].map((n) => (
          <div key={n} className="grid grid-cols-[1fr_9rem] gap-2">
            <Text label={`診断名 ${n}`} value={str(f, `dx${n}`)} onChange={s(`dx${n}`)} from={fromK(`dx${n}`)} />
            <Text label="発症年月日" value={str(f, `dx${n}Date`)} onChange={s(`dx${n}Date`)} from={fromK(`dx${n}Date`)} placeholder="YYYY-MM-DD" />
          </div>
        ))}
        <Choice label="症状としての安定性" value={str(f, 'stability')} options={STABILITY} onChange={s('stability')} />
        {str(f, 'stability') === '不安定' && <Text label="「不安定」の具体的な状況" value={str(f, 'stabilityNote')} onChange={s('stabilityNote')} />}
        <Text label="生活機能低下の直接の原因となっている傷病・特定疾病の経過及び投薬内容" value={str(f, 'course')} onChange={s('course')} rows={7} from={fromK('course')} />
      </Section>

      <Section title="2. 特別な医療" note="過去14日間以内に受けたもの">
        <Checks label="処置内容" value={list(f, 'treat')} options={TREAT} onChange={l('treat')} />
        <Checks label="特別な対応" value={list(f, 'special')} options={SPECIAL} onChange={l('special')} />
        <Checks label="失禁への対応" value={list(f, 'incont')} options={INCONT} onChange={l('incont')} />
      </Section>

      <Section title="3. 心身の状態に関する意見">
        <Choice label="障害高齢者の日常生活自立度（寝たきり度）" value={str(f, 'bedridden')} options={BEDRIDDEN} onChange={s('bedridden')} />
        <Choice label="認知症高齢者の日常生活自立度" value={str(f, 'dementia')} options={DEMENTIA} onChange={s('dementia')} />
        <Choice label="短期記憶" value={str(f, 'memory')} options={MEMORY} onChange={s('memory')} />
        <Choice label="日常の意思決定を行うための認知能力" value={str(f, 'decision')} options={DECISION} onChange={s('decision')} />
        <Choice label="自分の意思の伝達能力" value={str(f, 'communicate')} options={COMMUNICATE} onChange={s('communicate')} />
        <Choice label="認知症の周辺症状" value={str(f, 'bpsd')} options={NOYES} onChange={s('bpsd')} />
        {str(f, 'bpsd') === '有' && <Checks value={list(f, 'bpsdList')} options={BPSD} onChange={l('bpsdList')} />}
        <Choice label="その他の精神・神経症状" value={str(f, 'psych')} options={NOYES} onChange={s('psych')} />
        {str(f, 'psych') === '有' && <Text label="症状名・専門医受診の有無" value={str(f, 'psychNote')} onChange={s('psychNote')} />}
        <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-2.5">
          <Choice label="利き腕" value={str(f, 'hand')} options={HAND} onChange={s('hand')} />
          <Text label="身長" value={str(f, 'height')} onChange={s('height')} unit="cm" />
          <Text label="体重" value={str(f, 'weight')} onChange={s('weight')} unit="kg" from={fromK('weight')} />
        </div>
        <Choice label="過去6か月の体重の変化" value={str(f, 'weightTrend')} options={WEIGHT_TREND} onChange={s('weightTrend')} />
        <Checks label="身体の状態" value={list(f, 'body')} options={BODY} onChange={l('body')} />
        {list(f, 'body').length > 0 && <Text label="部位・程度" value={str(f, 'bodyNote')} onChange={s('bodyNote')} placeholder="例：右片麻痺（軽）、両膝の痛み（中）" />}
      </Section>

      <Section title="4. 生活機能とサービスに関する意見">
        <Choice label="屋外歩行" value={str(f, 'outdoor')} options={OUTDOOR} onChange={s('outdoor')} />
        <Choice label="車いすの使用" value={str(f, 'wheelchair')} options={WHEELCHAIR} onChange={s('wheelchair')} />
        <Checks label="歩行補助具・装具の使用" value={list(f, 'aids')} options={AIDS} onChange={l('aids')} />
        <Choice label="食事行為" value={str(f, 'meal')} options={MEAL} onChange={s('meal')} />
        <Choice label="現在の栄養状態" value={str(f, 'nutrition')} options={NUTRITION} onChange={s('nutrition')} />
        <Text label="栄養・食生活上の留意点" value={str(f, 'nutritionNote')} onChange={s('nutritionNote')} placeholder="例：減塩、間食を控える" />
        <Checks label="現在あるいは今後発生の可能性の高い状態" value={list(f, 'risks')} options={RISKS} onChange={l('risks')} />
        {list(f, 'risks').length > 0 && <Text label="対処方針" value={str(f, 'riskPlan')} onChange={s('riskPlan')} rows={2} />}
        <Choice label="サービス利用による生活機能の維持・改善の見通し" value={str(f, 'outlook')} options={OUTLOOK} onChange={s('outlook')} />
        <Checks label="医学的管理の必要性" value={list(f, 'needs')} options={NEEDS} onChange={l('needs')} />
        <div className="grid grid-cols-2 gap-2.5">
          {CAUTIONS.map(([k, label]) => (
            <Text key={k} label={`留意事項：${label}`} value={str(f, k)} onChange={s(k)} placeholder="空なら「特になし」" />
          ))}
        </div>
        <Choice label="感染症の有無" value={str(f, 'infection')} options={INFECTION} onChange={s('infection')} />
        {str(f, 'infection') === '有' && <Text label="感染症名" value={str(f, 'infectionNote')} onChange={s('infectionNote')} />}
      </Section>

      <Section title="5. 特記すべき事項">
        <Text label="要介護認定・介護サービス計画作成時に必要な医学的意見など" value={str(f, 'notes')} onChange={s('notes')} rows={4} />
      </Section>
    </>
  )
}

// ---- 印刷面 ----

const H = ({ children }: { children: React.ReactNode }) => <div className="mt-[2.5mm] mb-[1mm] text-[9.5pt] font-bold">{children}</div>
const Sub = ({ children }: { children: React.ReactNode }) => <span className="mr-[2mm] inline-block w-[28mm]">{children}</span>

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const dx = [1, 2, 3].map((n) => ({ name: str(f, `dx${n}`), date: str(f, `dx${n}Date`) }))
  return (
    <>
      <Paper>
        <div className="text-[8.5pt] leading-[1.4]">
          <div className="flex items-end justify-between">
            <h1 className="text-[15pt] font-bold tracking-[0.3em]">主治医意見書</h1>
            <div>記入日　{wareki(str(f, 'date'))}</div>
          </div>
          <div className="mt-[1mm] mb-[1.5mm]">
            申請区分　<Boxes options={APP_TYPES} value={str(f, 'appType')} />
          </div>
          <Table>
            <Row th="申請者" thW="24mm">
              <span className="text-[10.5pt]">{patient.name}</span>（{patient.kana}）　{patient.sex}　{birthLabel(patient.birth)}生（{age(patient.birth)}歳）
              <br />〒{patient.zip ?? ''}　{patient.address ?? ''}　連絡先 {patient.phone ?? ''}
            </Row>
            <Row th="同意" thW="24mm">
              上記の申請者に関する意見は以下の通りです。主治医として、本意見書が介護サービス計画作成等に利用されることに
              <Boxes options={CONSENT} value={str(f, 'consent')} />
            </Row>
            <Row th="主治医" thW="24mm">
              医師氏名　{CLINIC.doctor}　　医療機関名　{CLINIC.name}　電話 {CLINIC.phone}
              <br />
              所在地　〒{CLINIC.zip}　{CLINIC.address}　FAX {CLINIC.fax}
            </Row>
            <Row th="(1) 最終診察日" thW="24mm">
              {wareki(str(f, 'lastVisit'))}
            </Row>
            <Row th="(2) 意見書作成回数" thW="24mm">
              <Boxes options={COUNTS} value={str(f, 'count')} />
            </Row>
            <Row th="(3) 他科受診の有無" thW="24mm">
              <Boxes options={NOYES} value={str(f, 'otherDept')} />
              {str(f, 'otherDept') === '有' && (
                <>
                  （<Boxes options={DEPTS} value={list(f, 'otherDepts')} />）
                </>
              )}
            </Row>
          </Table>

          <H>1. 傷病に関する意見</H>
          <Table>
            <Row th="(1) 診断名" thW="24mm">
              {dx.map((d, i) => (
                <div key={i} className="flex border-b border-dotted border-[#999] last:border-b-0">
                  <span className="w-[5mm]">{i + 1}.</span>
                  <span className="flex-1">{d.name}</span>
                  <span className="w-[62mm]">発症年月日　{d.date ? birthLabel(d.date) : '　　年　　月　　日頃'}</span>
                </div>
              ))}
            </Row>
            <Row th="(2) 症状としての安定性" thW="24mm">
              <Boxes options={STABILITY} value={str(f, 'stability')} />
              {str(f, 'stabilityNote') && `　（${str(f, 'stabilityNote')}）`}
            </Row>
            <Row th="(3) 生活機能低下の直接の原因となっている傷病・特定疾病の経過及び投薬内容" thW="24mm" h="70mm">
              {str(f, 'course')}
            </Row>
          </Table>

          <H>2. 特別な医療（過去14日間以内に受けた医療のすべてにチェック）</H>
          <Table>
            <Row th="処置内容" thW="24mm">
              <Boxes options={TREAT} value={list(f, 'treat')} />
            </Row>
            <Row th="特別な対応" thW="24mm">
              <Boxes options={SPECIAL} value={list(f, 'special')} />
            </Row>
            <Row th="失禁への対応" thW="24mm">
              <Boxes options={INCONT} value={list(f, 'incont')} />
            </Row>
          </Table>
        </div>
        <div className="absolute right-[16mm] bottom-[10mm] text-[7.5pt]">（1／2）</div>
      </Paper>

      <Paper>
        <div className="text-[8.5pt] leading-[1.4]">
          <div className="text-[8pt]">申請者　{patient.name}</div>
          <H>3. 心身の状態に関する意見</H>
          <Table>
            <Row th="(1) 日常生活の自立度等" thW="24mm">
              <div>
                <Sub>障害高齢者</Sub>
                <Boxes options={BEDRIDDEN} value={str(f, 'bedridden')} />
              </div>
              <div>
                <Sub>認知症高齢者</Sub>
                <Boxes options={DEMENTIA} value={str(f, 'dementia')} />
              </div>
            </Row>
            <Row th="(2) 認知症の中核症状" thW="24mm">
              <div>
                <Sub>短期記憶</Sub>
                <Boxes options={MEMORY} value={str(f, 'memory')} />
              </div>
              <div>
                <Sub>日常の意思決定</Sub>
                <Boxes options={DECISION} value={str(f, 'decision')} />
              </div>
              <div>
                <Sub>自分の意思の伝達</Sub>
                <Boxes options={COMMUNICATE} value={str(f, 'communicate')} />
              </div>
            </Row>
            <Row th="(3) 認知症の周辺症状" thW="24mm">
              <Boxes options={NOYES} value={str(f, 'bpsd')} />
              {str(f, 'bpsd') === '有' && (
                <div>
                  <Boxes options={BPSD} value={list(f, 'bpsdList')} />
                </div>
              )}
            </Row>
            <Row th="(4) その他の精神・神経症状" thW="24mm">
              <Boxes options={NOYES} value={str(f, 'psych')} />
              {str(f, 'psychNote') && `　（${str(f, 'psychNote')}）`}
            </Row>
            <Row th="(5) 身体の状態" thW="24mm">
              <div>
                利き腕 <Boxes options={HAND} value={str(f, 'hand')} />　身長 {str(f, 'height') || '　　'} cm　体重 {str(f, 'weight') || '　　'} kg（過去6か月の体重の変化{' '}
                <Boxes options={WEIGHT_TREND} value={str(f, 'weightTrend')} />）
              </div>
              <div>
                <Boxes options={BODY} value={list(f, 'body')} />
              </div>
              {str(f, 'bodyNote') && <div>部位・程度：{str(f, 'bodyNote')}</div>}
            </Row>
          </Table>

          <H>4. 生活機能とサービスに関する意見</H>
          <Table>
            <Row th="(1) 移動" thW="24mm">
              <div>
                <Sub>屋外歩行</Sub>
                <Boxes options={OUTDOOR} value={str(f, 'outdoor')} />
              </div>
              <div>
                <Sub>車いすの使用</Sub>
                <Boxes options={WHEELCHAIR} value={str(f, 'wheelchair')} />
              </div>
              <div>
                <Sub>歩行補助具・装具</Sub>
                <Boxes options={AIDS} value={list(f, 'aids')} />
              </div>
            </Row>
            <Row th="(2) 栄養・食生活" thW="24mm">
              <div>
                <Sub>食事行為</Sub>
                <Boxes options={MEAL} value={str(f, 'meal')} />
              </div>
              <div>
                <Sub>現在の栄養状態</Sub>
                <Boxes options={NUTRITION} value={str(f, 'nutrition')} />
              </div>
              <div>→ 栄養・食生活上の留意点（{str(f, 'nutritionNote') || '　　　　　　'}）</div>
            </Row>
            <Row th="(3) 現在あるいは今後発生の可能性の高い状態とその対処方針" thW="24mm">
              <Boxes options={RISKS} value={list(f, 'risks')} />
              <div>→ 対処方針（{str(f, 'riskPlan') || '　　　　　　'}）</div>
            </Row>
            <Row th="(4) 生活機能の維持・改善の見通し" thW="24mm">
              <Boxes options={OUTLOOK} value={str(f, 'outlook')} />
            </Row>
            <Row th="(5) 医学的管理の必要性" thW="24mm">
              <Boxes options={NEEDS} value={list(f, 'needs')} />
            </Row>
            <Row th="(6) サービス提供時の医学的観点からの留意事項" thW="24mm">
              <div className="grid grid-cols-2 gap-x-[4mm]">
                {CAUTIONS.map(([k, label]) => (
                  <div key={k}>
                    ・{label}　{str(f, k) ? <>□特になし ■あり（{str(f, k)}）</> : '■特になし □あり'}
                  </div>
                ))}
              </div>
            </Row>
            <Row th="(7) 感染症の有無" thW="24mm">
              <Boxes options={INFECTION} value={str(f, 'infection')} />
              {str(f, 'infectionNote') && `　（${str(f, 'infectionNote')}）`}
            </Row>
          </Table>

          <H>5. 特記すべき事項</H>
          <Table>
            <div className="min-h-[30mm] px-[2mm] py-[1mm] whitespace-pre-wrap">{str(f, 'notes')}</div>
          </Table>
        </div>
        <div className="absolute right-[16mm] bottom-[10mm] text-[7.5pt]">（2／2）</div>
      </Paper>
    </>
  )
}

export const careOpinionDoc: DocDef = {
  kind: 'careOpinion',
  title: '主治医意見書',
  icon: 'elderly',
  desc: '介護保険の申請用。病名・処方・最終診察日をカルテから',
  group: '意見書・指示書',
  init,
  Form,
  Sheet,
  pages: () => 2,
}
