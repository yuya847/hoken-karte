import { CLINIC, age, ymd, today } from '../data'
import { activeDiseases, byDateDesc, currentRx } from '../karte'
import { birthLabel } from '../PatientIcon'
import { Paper } from '../print'
import { rxLine } from '../rxFormat'
import type { DocFields, KarteDoc, Patient } from '../types'
import { Boxes, Checks, Choice, ClinicSign, Row, Section, Table, Text, bool, list, str, wareki } from './kit'
import type { DocDef, DocProps } from './registry'

// 訪問看護指示書（在宅患者訪問点滴注射指示書を兼ねられる）。A4 1枚。
// 病名・病状・処方・介護度はカルテから。指示期間は開始日と長さ（1・3・6か月）を選ぶと終わりの日を入れる（最長6か月）

const PERIODS = ['1か月', '3か月', '6か月']
const BEDRIDDEN = ['自立', 'J1', 'J2', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const DEMENTIA = ['自立', 'Ⅰ', 'Ⅱa', 'Ⅱb', 'Ⅲa', 'Ⅲb', 'Ⅳ', 'M']
const CARE = ['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5']
const ULCER = ['なし', 'NPUAP分類 Ⅲ度', 'NPUAP分類 Ⅳ度', 'DESIGN-R分類 D3', 'DESIGN-R分類 D4', 'DESIGN-R分類 D5']
const DEVICES = ['自動腹膜灌流装置', '透析液供給装置', '酸素療法', '吸引器', '中心静脈栄養', '輸液ポンプ', '経管栄養', '留置カテーテル', '人工呼吸器', '気管カニューレ', '人工肛門', '人工膀胱', 'その他']
const NOYES = ['無', '有']
const INSTRUCTIONS: [string, string][] = [
  ['inst1', '療養生活指導上の留意事項'],
  ['inst2', 'リハビリテーション'],
  ['inst3', '褥瘡の処置等'],
  ['inst4', '装着・使用医療機器等の操作援助・管理'],
  ['inst5', 'その他'],
]

// 開始日から n か月の指示期間の終わり（前日まで）
const endOf = (start: string, months: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return ''
  const d = new Date(`${start}T00:00:00`)
  d.setMonth(d.getMonth() + months)
  d.setDate(d.getDate() - 1)
  return ymd(d)
}
const monthsOf = (p: string) => Number(p.replace(/\D/g, '')) || 1

const init = (p: Patient): DocFields => {
  const dx = activeDiseases(p)
    .filter((d) => !d.suspected)
    .sort((a, b) => Number(b.main) - Number(a.main))
  const last = byDateDesc(p.encounters)[0]
  const start = today()
  return {
    date: today(),
    iv: false,
    period: '1か月',
    start,
    end: endOf(start, 1),
    ivStart: '',
    ivEnd: '',
    station: '',
    stationPhone: '',
    dx: dx
      .slice(0, 3)
      .map((d) => d.name)
      .join('、'),
    state: last?.text ?? '',
    meds: currentRx(p)
      .map((r, i) => `${i + 1}. ${rxLine(r)}`)
      .join('\n'),
    bedridden: '',
    dementia: '自立',
    care: p.careLevel ?? '',
    ulcer: 'なし',
    devices: [],
    devicesNote: '',
    inst1: '',
    inst2: '',
    inst3: '',
    inst4: '',
    inst5: '',
    ivOrder: '',
    emergency: `${CLINIC.name}　${CLINIC.phone}（${CLINIC.doctor}）`,
    absent: '',
    notes: '',
    otherStation: '無',
    otherStationName: '',
    suction: '無',
    suctionName: '',
  }
}

function Form({ patient, doc, set }: DocProps) {
  const f = doc.fields
  const s = (k: string) => (v: string) => set({ [k]: v })
  const auto = init(patient)
  const fromK = (k: string) => !!str(auto, k) && str(f, k) === str(auto, k)
  const period = str(f, 'period')

  return (
    <>
      <Section title="指示期間">
        <Choice
          label="長さ（最長6か月）"
          value={period}
          options={PERIODS}
          onChange={(v) => set({ period: v, end: v ? endOf(str(f, 'start'), monthsOf(v)) : str(f, 'end') })}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Text label="開始日" value={str(f, 'start')} onChange={(v) => set({ start: v, end: period ? endOf(v, monthsOf(period)) : str(f, 'end') })} placeholder="YYYY-MM-DD" />
          <Text label="終了日" value={str(f, 'end')} onChange={s('end')} placeholder="YYYY-MM-DD" />
        </div>
        <button
          type="button"
          onClick={() => set({ iv: !bool(f, 'iv') })}
          aria-pressed={bool(f, 'iv')}
          className={`chip h-7 text-xs ${bool(f, 'iv') ? 'chip-on' : ''}`}
        >
          {bool(f, 'iv') ? '✓ ' : ''}在宅患者訪問点滴注射指示書を兼ねる
        </button>
        {bool(f, 'iv') && (
          <div className="grid grid-cols-2 gap-2.5">
            <Text label="点滴注射指示期間 開始" value={str(f, 'ivStart')} onChange={s('ivStart')} placeholder="YYYY-MM-DD（最長7日）" />
            <Text label="終了" value={str(f, 'ivEnd')} onChange={s('ivEnd')} placeholder="YYYY-MM-DD" />
          </div>
        )}
      </Section>

      <Section title="訪問看護ステーション">
        <div className="grid grid-cols-[1fr_10rem] gap-2.5">
          <Text label="ステーション名" value={str(f, 'station')} onChange={s('station')} placeholder="例：サンプル訪問看護ステーション" />
          <Text label="電話" value={str(f, 'stationPhone')} onChange={s('stationPhone')} />
        </div>
      </Section>

      <Section title="患者の状態">
        <Text label="主たる傷病名" value={str(f, 'dx')} onChange={s('dx')} from={fromK('dx')} />
        <Text label="病状・治療状態" value={str(f, 'state')} onChange={s('state')} rows={3} from={fromK('state')} />
        <Text label="投与中の薬剤の用量・用法" value={str(f, 'meds')} onChange={s('meds')} rows={4} from={fromK('meds')} />
        <Choice label="日常生活自立度：寝たきり度" value={str(f, 'bedridden')} options={BEDRIDDEN} onChange={s('bedridden')} />
        <Choice label="日常生活自立度：認知症の状況" value={str(f, 'dementia')} options={DEMENTIA} onChange={s('dementia')} />
        <Choice label="要介護認定の状況" value={str(f, 'care')} options={CARE} onChange={s('care')} />
        <Choice label="褥瘡の深さ" value={str(f, 'ulcer')} options={ULCER} onChange={s('ulcer')} />
        <Checks label="装着・使用医療機器等" value={list(f, 'devices')} options={DEVICES} onChange={(v) => set({ devices: v })} />
        {list(f, 'devices').length > 0 && <Text label="機器の設定・サイズ等" value={str(f, 'devicesNote')} onChange={s('devicesNote')} placeholder="例：酸素 1L/分、バルーン 14Fr" />}
      </Section>

      <Section title="留意事項及び指示事項">
        {INSTRUCTIONS.map(([k, label]) => (
          <Text key={k} label={label} value={str(f, k)} onChange={s(k)} rows={2} />
        ))}
        {bool(f, 'iv') && <Text label="在宅患者訪問点滴注射に関する指示（投与薬剤・投与量・投与方法等）" value={str(f, 'ivOrder')} onChange={s('ivOrder')} rows={3} />}
      </Section>

      <Section title="連絡・その他">
        <Text label="緊急時の連絡先" value={str(f, 'emergency')} onChange={s('emergency')} />
        <Text label="不在時の対応法" value={str(f, 'absent')} onChange={s('absent')} placeholder="例：携帯へ連絡。不通時は救急要請" />
        <Text label="特記すべき留意事項" value={str(f, 'notes')} onChange={s('notes')} rows={2} placeholder="薬の相互作用・副作用の注意点、薬物アレルギーの既往など" />
        <Choice label="他の訪問看護ステーションへの指示" value={str(f, 'otherStation')} options={NOYES} onChange={s('otherStation')} />
        {str(f, 'otherStation') === '有' && <Text label="指定訪問看護ステーション名" value={str(f, 'otherStationName')} onChange={s('otherStationName')} />}
        <Choice label="たんの吸引等実施のための訪問介護事業所への指示" value={str(f, 'suction')} options={NOYES} onChange={s('suction')} />
        {str(f, 'suction') === '有' && <Text label="訪問介護事業所名" value={str(f, 'suctionName')} onChange={s('suctionName')} />}
      </Section>
    </>
  )
}

const period = (a: string, b: string) => `${wareki(a)} 〜 ${wareki(b)}`

function Sheet({ patient, doc }: { patient: Patient; doc: KarteDoc }) {
  const f = doc.fields
  const iv = bool(f, 'iv')
  return (
    <Paper>
      <div className="text-[8.5pt] leading-[1.4]">
        <h1 className="text-center text-[14pt] font-bold tracking-[0.15em]">
          訪問看護指示書
          <span className="ml-[3mm] text-[10pt] font-normal tracking-normal">{iv ? '■' : '□'}在宅患者訪問点滴注射指示書</span>
        </h1>
        <div className="mt-[1mm] mb-[1.5mm] text-center text-[7.5pt]">※該当する指示書を○で囲むこと</div>
        <div className="mb-[1mm] flex flex-col items-end">
          <div>訪問看護指示期間　{period(str(f, 'start'), str(f, 'end'))}</div>
          <div>点滴注射指示期間　{iv ? period(str(f, 'ivStart'), str(f, 'ivEnd')) : '令和　年　月　日 〜 令和　年　月　日'}</div>
        </div>
        <Table>
          <Row th="患者氏名" thW="30mm">
            <span className="text-[10.5pt]">{patient.name}</span>　様　　{birthLabel(patient.birth)}生（{age(patient.birth)}歳）
          </Row>
          <Row th="患者住所" thW="30mm">
            〒{patient.zip ?? ''}　{patient.address ?? ''}　電話 {patient.phone ?? ''}
          </Row>
          <Row th="主たる傷病名" thW="30mm">
            {str(f, 'dx')}
          </Row>
          <Row th="病状・治療状態" thW="30mm" h="11mm">
            {str(f, 'state')}
          </Row>
          <Row th="投与中の薬剤の用量・用法" thW="30mm" h="16mm">
            {str(f, 'meds')}
          </Row>
          <Row th="日常生活自立度" thW="30mm">
            <div>
              寝たきり度　<Boxes options={BEDRIDDEN} value={str(f, 'bedridden')} />
            </div>
            <div>
              認知症の状況　<Boxes options={DEMENTIA} value={str(f, 'dementia')} />
            </div>
          </Row>
          <Row th="要介護認定の状況" thW="30mm">
            <Boxes options={CARE} value={str(f, 'care')} />
          </Row>
          <Row th="褥瘡の深さ" thW="30mm">
            <Boxes options={ULCER} value={str(f, 'ulcer')} />
          </Row>
          <Row th="装着・使用医療機器等" thW="30mm">
            <Boxes options={DEVICES} value={list(f, 'devices')} />
            {str(f, 'devicesNote') && <div>（{str(f, 'devicesNote')}）</div>}
          </Row>
        </Table>

        <div className="mt-[1.5mm] mb-[0.5mm] font-bold">留意事項及び指示事項</div>
        <Table>
          {INSTRUCTIONS.map(([k, label], i) => (
            <Row key={k} th={`${['Ⅰ', 'Ⅱ-1', 'Ⅱ-2', 'Ⅱ-3', 'Ⅱ-4'][i]} ${label}`} thW="58mm" h={i === 0 ? '14mm' : '9mm'}>
              {str(f, k)}
            </Row>
          ))}
          <Row th="在宅患者訪問点滴注射に関する指示（投与薬剤・投与量・投与方法等）" thW="58mm" h="11mm">
            {iv ? str(f, 'ivOrder') : ''}
          </Row>
          <Row th="緊急時の連絡先" thW="58mm">
            {str(f, 'emergency')}
          </Row>
          <Row th="不在時の対応法" thW="58mm">
            {str(f, 'absent')}
          </Row>
          <Row th="特記すべき留意事項" thW="58mm" h="8mm">
            {str(f, 'notes')}
          </Row>
          <Row th="他の訪問看護ステーションへの指示" thW="58mm">
            <Boxes options={NOYES} value={str(f, 'otherStation')} />
            {str(f, 'otherStation') === '有' && `　指定訪問看護ステーション名（${str(f, 'otherStationName')}）`}
          </Row>
          <Row th="たんの吸引等実施のための訪問介護事業所への指示" thW="58mm">
            <Boxes options={NOYES} value={str(f, 'suction')} />
            {str(f, 'suction') === '有' && `　訪問介護事業所名（${str(f, 'suctionName')}）`}
          </Row>
        </Table>

        <div className="mt-[1.5mm]">上記のとおり、指示いたします。</div>
        <div className="flex items-end gap-[6mm]">
          <div className="mb-[1mm] flex-1">
            <div className="text-[10pt]">{str(f, 'station') || '　　　　　　　　　　　　'}　殿</div>
            {str(f, 'stationPhone') && <div>電話 {str(f, 'stationPhone')}</div>}
          </div>
          <ClinicSign date={str(f, 'date')} />
        </div>
      </div>
    </Paper>
  )
}

export const nursingOrderDoc: DocDef = {
  kind: 'nursingOrder',
  title: '訪問看護指示書',
  icon: 'home_health',
  desc: '訪問看護ステーションあて。病名・処方・介護度をカルテから',
  group: '意見書・指示書',
  init,
  Form,
  Sheet,
}
