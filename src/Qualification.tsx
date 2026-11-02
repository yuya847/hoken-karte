import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { age, today, uid } from './data'
import { birthLabel } from './PatientIcon'
import type { Action } from './store'
import type { Insurer, Patient, Qualification } from './types'

// オンライン資格確認（マイナ保険証）と新患登録。
// 試作では外へ何も問い合わせない。応答はすべて架空（患者IDごとに決めた値）

type Method = Qualification['method']
const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: 'マイナ保険証', label: 'マイナ保険証', hint: '顔認証付きカードリーダーで本人確認' },
  { id: '資格確認書', label: '資格確認書', hint: '記号・番号で照会' },
  { id: '保険証', label: '保険証', hint: '記号・番号で照会（経過措置）' },
]

// ---- 架空の応答 ----

type DrugInfo = { date: string; clinic: string; name: string; usage: string; amount: string }
type Checkup = { date: string; items: [string, string][]; judge: string }
type Reply = { insurer: Insurer; burden: number; limitClass?: string; consent: Qualification['consent']; drugs: DrugInfo[]; checkup?: Checkup }

const ago = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

const FAKE: Record<string, Partial<Reply>> = {
  p1: {
    consent: { drugs: true, checkups: true, records: true },
    drugs: [
      { date: ago(41), clinic: 'サンプル整形外科（架空）', name: 'セレコキシブ錠100mg', usage: '1日2回 朝夕食後', amount: '14日分' },
      { date: ago(41), clinic: 'サンプル整形外科（架空）', name: 'レバミピド錠100mg', usage: '1日2回 朝夕食後', amount: '14日分' },
      { date: ago(75), clinic: 'サンプル眼科（架空）', name: 'ヒアルロン酸Na点眼液0.1%', usage: '1日4回 両眼', amount: '2本' },
    ],
    checkup: {
      date: ago(140),
      items: [
        ['BMI', '25.8'],
        ['腹囲', '88 cm'],
        ['血圧', '138/86'],
        ['HbA1c', '7.0 %'],
        ['LDL-C', '142 mg/dL'],
        ['尿蛋白', '（−）'],
      ],
      judge: '要医療（血糖・脂質）',
    },
  },
  // 転職で保険者が変わった想定（登録内容との違いが出る）
  p2: {
    insurer: { payer: '06138888', symbol: '12', number: '3301', branch: '02', relation: '家族' },
    consent: { drugs: true, checkups: false, records: false },
    drugs: [{ date: ago(20), clinic: 'サンプル耳鼻咽喉科（架空）', name: 'フェキソフェナジン錠60mg', usage: '1日2回 朝夕食後', amount: '14日分' }],
  },
  p3: { consent: { drugs: false, checkups: false, records: false } },
  p4: {
    consent: { drugs: true, checkups: true, records: false },
    // 登録しているアレルギー（ロキソプロフェン）と重なる薬が他院で出ている想定
    drugs: [{ date: ago(12), clinic: 'サンプル歯科（架空）', name: 'ロキソプロフェン錠60mg', usage: '疼痛時 1回1錠', amount: '5回分' }],
    checkup: {
      date: ago(210),
      items: [
        ['BMI', '22.1'],
        ['腹囲', '79 cm'],
        ['血圧', '132/84'],
        ['HbA1c', '5.6 %'],
        ['LDL-C', '118 mg/dL'],
      ],
      judge: '要経過観察（血圧）',
    },
  },
  p5: {
    limitClass: '一般Ⅰ',
    consent: { drugs: true, checkups: true, records: true },
    drugs: [
      { date: ago(30), clinic: 'サンプル整形外科（架空）', name: 'アレンドロン酸錠35mg', usage: '週1回 起床時', amount: '4回分' },
      { date: ago(30), clinic: 'サンプル整形外科（架空）', name: 'エルデカルシトールカプセル0.75μg', usage: '1日1回 朝食後', amount: '28日分' },
    ],
    checkup: {
      date: ago(300),
      items: [
        ['BMI', '23.0'],
        ['血圧', '136/78'],
        ['HbA1c', '7.6 %'],
        ['eGFR', '58'],
      ],
      judge: '治療中（糖尿病）',
    },
  },
}

const reply = (p: Patient): Reply => {
  const f = FAKE[p.id] ?? {}
  return {
    insurer: f.insurer ?? p.insurer ?? { payer: '', number: '', relation: '本人' },
    burden: f.burden ?? p.burden,
    limitClass: f.limitClass,
    consent: f.consent ?? { drugs: true, checkups: true, records: true },
    drugs: f.drugs ?? [],
    checkup: f.checkup,
  }
}

const INSURER_FIELDS: { key: keyof Insurer; label: string }[] = [
  { key: 'payer', label: '保険者番号' },
  { key: 'symbol', label: '記号' },
  { key: 'number', label: '番号' },
  { key: 'branch', label: '枝番' },
  { key: 'relation', label: '本人・家族' },
]

// 登録内容と確認結果の違い
const diffOf = (p: Patient, r: Reply) => {
  const out = INSURER_FIELDS.filter((f) => (p.insurer?.[f.key] ?? '') !== (r.insurer[f.key] ?? '')).map((f) => `${f.label} ${p.insurer?.[f.key] || '未登録'} → ${r.insurer[f.key] || '—'}`)
  if (p.burden !== r.burden) out.push(`負担割合 ${pct(p.burden)} → ${pct(r.burden)}`)
  return out
}

const pct = (b: number) => `${Math.round(b * 10)}割`
const time = (iso: string) => new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
const isToday = (iso: string) => iso.slice(0, 10) === today() || new Date(iso).toDateString() === new Date().toDateString()

// ---- 札 ----

export const qualState = (p: Patient): '未確認' | '確認済' | '要確認' => {
  const q = p.qualification
  if (!q || !isToday(q.checkedAt)) return '未確認'
  return q.diff?.length || !q.valid ? '要確認' : '確認済'
}

const BADGE: Record<ReturnType<typeof qualState>, { cls: string; icon: string }> = {
  未確認: { cls: 'border border-line bg-cream text-mist', icon: 'id_card' },
  確認済: { cls: 'bg-[#e6f6f2] text-[#0d6e61]', icon: 'verified_user' },
  要確認: { cls: 'bg-[#fff1d6] text-[#8a5a00]', icon: 'warning' },
}

const shortMethod = (m: Method) => (m === 'マイナ保険証' ? 'マイナ' : m === '資格確認書' ? '確認書' : '保険証')

// 受付の行（compact）と患者の帯に置く札。押すと資格確認のウインドウ
export function QualBadge({ patient, dispatch, compact }: { patient: Patient; dispatch: (a: Action) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const st = qualState(patient)
  const q = patient.qualification
  const b = BADGE[st]
  const label = st === '未確認' ? '資格 未確認' : st === '要確認' ? '資格 要確認' : `確認済 ${shortMethod(q!.method)} ${time(q!.checkedAt)}`
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
        title={st === '要確認' ? `登録内容と違いがあります：${q?.diff?.join('、')}` : 'オンライン資格確認'}
        className={`inline-flex shrink-0 items-center gap-1 rounded font-medium whitespace-nowrap hover:brightness-95 ${b.cls} ${compact ? 'h-6 px-1.5 text-[0.6875rem] touch:h-9' : 'h-6 px-2 text-xs'}`}
      >
        <Icon name={b.icon} size={compact ? 14 : 15} fill={st !== '未確認'} />
        {compact && st === '確認済' ? `${shortMethod(q!.method)} ${time(q!.checkedAt)}` : label}
      </button>
      {open && <QualificationDialog patient={patient} dispatch={dispatch} onClose={() => setOpen(false)} />}
    </>
  )
}

// ---- ダイアログ（ファストカルテの形：墨の薄い幕＋白い角丸の箱） ----

export function Dialog({ label, onClose, children, wide }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onClose])
  // 受付の表の行の中に置かれるので、中のクリックが行（カルテを開く）に伝わらないようにする
  return (
    <div className="no-print fixed inset-0 z-[95] flex items-center justify-center p-4 max-md:items-end max-md:p-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button aria-label="閉じる" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-ivory text-left shadow-2xl max-md:max-h-[94dvh] max-md:rounded-b-none ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHead({ icon, title, sub, onClose }: { icon: string; title: string; sub?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {sub && <div className="truncate text-xs text-mist">{sub}</div>}
      </div>
      <button onClick={onClose} title="閉じる（Esc）" className="icon-btn icon-btn-sm">
        <Icon name="close" size={20} />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-line bg-cream p-0.5 text-sm">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id} className={`flex-1 rounded-md px-3 py-1.5 whitespace-nowrap ${value === o.id ? 'bg-ivory font-medium shadow-soft' : 'text-mist hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function QualificationDialog({ patient, dispatch, onClose }: { patient: Patient; dispatch: (a: Action) => void; onClose: () => void }) {
  const done0 = patient.qualification && isToday(patient.qualification.checkedAt)
  const [method, setMethod] = useState<Method>(patient.qualification?.method ?? 'マイナ保険証')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>(done0 ? 'done' : 'idle')
  const goRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (phase === 'idle') goRef.current?.focus()
  }, [phase])

  const r = reply(patient)
  const q = patient.qualification
  const diff = q?.diff ?? []

  const check = () => {
    setPhase('loading')
    setTimeout(() => {
      const d = diffOf(patient, r)
      dispatch({
        type: 'qualify',
        patientId: patient.id,
        q: { checkedAt: new Date().toISOString(), method, valid: true, burden: r.burden, limitClass: r.limitClass, consent: r.consent, diff: d.length ? d : undefined },
      })
      setPhase('done')
    }, 900)
  }

  const update = () =>
    dispatch({
      type: 'qualify',
      patientId: patient.id,
      q: { ...q!, diff: undefined },
      patch: { insurer: r.insurer, burden: r.burden },
    })

  const allergyHit = (name: string) => patient.allergies.find((a) => name.includes(a.split('（')[0]))

  return (
    <Dialog label="オンライン資格確認" onClose={onClose} wide={phase === 'done'}>
      <DialogHead
        icon="id_card"
        title="オンライン資格確認"
        sub={
          <>
            {patient.name}（{patient.kana}）・{birthLabel(patient.birth)}生・{age(patient.birth)}歳
          </>
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {phase !== 'done' ? (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs text-mist">確認の方法</div>
              <Segmented value={method} options={METHODS} onChange={setMethod} />
              <p className="mt-1.5 text-xs text-mist">{METHODS.find((m) => m.id === method)!.hint}</p>
            </div>
            <div className="rounded-lg bg-surface-1 px-4 py-3 text-sm">
              <div className="mb-1 text-xs text-mist">登録している保険</div>
              <div>
                {patient.insurance} {pct(patient.burden)}
              </div>
              <div className="font-num text-xs text-mist">
                {patient.insurer ? INSURER_FIELDS.map((f) => `${f.label} ${patient.insurer?.[f.key] || '—'}`).join('　') : '保険者番号が登録されていません'}
              </div>
            </div>
            <button ref={goRef} onClick={check} disabled={phase === 'loading'} className="btn btn-filled w-full justify-center disabled:opacity-70">
              {phase === 'loading' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ivory/40 border-t-ivory" />
                  照会しています…
                </>
              ) : (
                <>
                  <Icon name="verified_user" size={18} />
                  資格確認する <span className="kbd">Enter</span>
                </>
              )}
            </button>
            <p className="text-[0.6875rem] text-mist">試作のため、外部には問い合わせず架空の応答を表示します。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#e6f6f2] px-2 py-1 text-sm font-semibold text-[#0d6e61]">
                <Icon name="check_circle" fill size={18} />
                資格 有効
              </span>
              <span className="text-xs text-mist">
                {q && `${q.method}で確認 ${new Date(q.checkedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              </span>
              <span className="flex-1" />
              <button onClick={() => setPhase('idle')} className="btn btn-sm btn-text">
                <Icon name="refresh" size={16} />
                もう一度確認
              </button>
            </div>

            {diff.length > 0 && (
              <div className="rounded-lg border border-[#e8c77a] bg-[#fff8e6] px-4 py-3 text-sm">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-[#8a5a00]">
                  <Icon name="warning" fill size={18} />
                  登録内容と違いがあります
                </div>
                <ul className="list-inside list-disc text-[0.8125rem]">
                  {diff.map((d) => (
                    <li key={d} className="font-num">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  <tr>
                    <th className="w-32 bg-cream px-3 py-1.5 text-left text-xs font-normal text-mist">保険</th>
                    <td className="px-3 py-1.5">{patient.insurance}</td>
                  </tr>
                  {INSURER_FIELDS.map((f) => {
                    const changed = (patient.insurer?.[f.key] ?? '') !== (r.insurer[f.key] ?? '')
                    return (
                      <tr key={f.key} className={changed && diff.length ? 'bg-[#fff8e6]' : ''}>
                        <th className="bg-cream px-3 py-1.5 text-left text-xs font-normal text-mist">{f.label}</th>
                        <td className="font-num px-3 py-1.5">{r.insurer[f.key] || '—'}</td>
                      </tr>
                    )
                  })}
                  <tr>
                    <th className="bg-cream px-3 py-1.5 text-left text-xs font-normal text-mist">負担割合</th>
                    <td className="px-3 py-1.5 font-medium">{pct(r.burden)}</td>
                  </tr>
                  {r.limitClass && (
                    <tr>
                      <th className="bg-cream px-3 py-1.5 text-left text-xs font-normal text-mist">限度額適用区分</th>
                      <td className="px-3 py-1.5">{r.limitClass}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="mb-1.5 text-xs text-mist">閲覧の同意（患者がカードリーダーで選んだもの）</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['drugs', '薬剤情報'],
                    ['checkups', '特定健診情報'],
                    ['records', '診療情報'],
                  ] as const
                ).map(([k, l]) => (
                  <span key={k} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs ${r.consent[k] ? 'bg-[#e6f6f2] text-[#0d6e61]' : 'border border-line text-mist'}`}>
                    <Icon name={r.consent[k] ? 'check' : 'block'} size={14} />
                    {l} {r.consent[k] ? '同意あり' : '同意なし'}
                  </span>
                ))}
              </div>
            </div>

            {r.consent.drugs && (
              <section>
                <h3 className="mb-1.5 text-[0.8125rem] font-semibold">薬剤情報（他の医療機関・直近3か月）</h3>
                {r.drugs.length === 0 ? (
                  <p className="text-xs text-mist">ありません</p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                    {r.drugs.map((d, i) => {
                      const hit = allergyHit(d.name)
                      return (
                        <li key={i} className={`flex flex-wrap items-baseline gap-x-3 px-3 py-1.5 text-[0.8125rem] ${hit ? 'bg-error-ctr' : ''}`}>
                          <span className="font-num w-20 shrink-0 text-xs text-mist">{d.date}</span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{d.name}</span>
                            <span className="ml-2 text-xs text-mist">
                              {d.usage} {d.amount}
                            </span>
                            {hit && <span className="ml-2 text-xs font-medium text-error">アレルギー登録（{hit}）と重なります</span>}
                          </span>
                          <span className="text-xs text-mist">{d.clinic}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )}

            {r.consent.checkups && r.checkup && (
              <section>
                <h3 className="mb-1.5 text-[0.8125rem] font-semibold">特定健診（{r.checkup.date}）</h3>
                <div className="flex flex-wrap gap-1.5">
                  {r.checkup.items.map(([k, v]) => (
                    <span key={k} className="rounded-md bg-surface-1 px-2 py-1 text-xs">
                      <span className="text-mist">{k}</span> <span className="font-num font-medium">{v}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs">
                  判定：<span className="font-medium">{r.checkup.judge}</span>
                </p>
              </section>
            )}
            <p className="text-[0.6875rem] text-mist">表示している応答はすべて架空です。</p>
          </div>
        )}
      </div>
      {phase === 'done' && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
          {diff.length > 0 ? (
            <button onClick={update} className="btn btn-filled">
              <Icon name="sync" size={18} />
              登録内容を更新
            </button>
          ) : (
            <span className="mr-auto flex items-center gap-1 text-xs text-mist">
              <Icon name="check" size={16} />
              登録内容と一致しています
            </span>
          )}
          <button onClick={onClose} className="btn btn-outlined">
            閉じる
          </button>
        </div>
      )}
    </Dialog>
  )
}

// ---- 新患登録 ----

const INSURANCE_TYPES = ['協会けんぽ', '組合健保', '国保', '共済', '後期高齢者', '生活保護'] as const
type Form = {
  name: string
  kana: string
  sex: '男' | '女' | ''
  birth: string
  phone: string
  zip: string
  address: string
  type: string
  relation: '本人' | '家族'
  payer: string
  symbol: string
  number: string
  branch: string
  burden: number | null // null＝年齢から自動
  allergies: string
}
const EMPTY: Form = { name: '', kana: '', sex: '', birth: '', phone: '', zip: '', address: '', type: '協会けんぽ', relation: '本人', payer: '', symbol: '', number: '', branch: '', burden: null, allergies: '' }

// マイナ保険証で読み取ったときの架空の人（順に使う）
const MYNA_SAMPLES: Form[] = [
  { ...EMPTY, name: '中村 由美', kana: 'ナカムラ ユミ', sex: '女', birth: '1988-03-21', phone: '090-0000-6789', zip: '100-0006', address: '東京都サンプル区北町6-2-8', type: '組合健保', relation: '本人', payer: '06139999', symbol: '31', number: '507', branch: '00' },
  { ...EMPTY, name: '小林 正', kana: 'コバヤシ タダシ', sex: '男', birth: '1946-10-02', phone: '03-0000-7890', zip: '100-0007', address: '東京都サンプル区本町8-3-1', type: '後期高齢者', relation: '本人', payer: '39139999', number: '00456789' },
]
let mynaNext = 0

const toKata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
const isKanaOnly = (s: string) => /^[ぁ-ゖァ-ヶー\s　]+$/.test(s)

// 年齢から負担割合を決める（仮。70歳以上は所得区分で変わる。正式な判定はレセコンで行う）
const autoBurden = (birth: string, type: string) => {
  if (!birth) return 0.3
  const a = age(birth)
  if (type === '生活保護') return 0
  if (a < 6) return 0.2
  if (a >= 75 || type === '後期高齢者') return 0.1
  if (a >= 70) return 0.2
  return 0.3
}

export function NewPatientButton({ dispatch }: { patients: Patient[]; dispatch: (a: Action) => void }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), 4000)
    return () => clearTimeout(t)
  }, [done])
  return (
    <>
      {done && (
        <span role="status" className="flex items-center gap-1 text-xs text-[#0d6e61]">
          <Icon name="check_circle" fill size={16} />
          {done}
        </span>
      )}
      <button onClick={() => setOpen(true)} className="btn btn-sm btn-filled">
        <Icon name="person_add" size={18} />
        新患登録
      </button>
      {open && (
        <NewPatientDialog
          onClose={() => setOpen(false)}
          onSave={(p) => {
            dispatch({ type: 'addPatient', patient: p })
            setOpen(false)
            setDone(`${p.name} さんを受付に登録しました`)
          }}
        />
      )}
    </>
  )
}

function NewPatientDialog({ onClose, onSave }: { onClose: () => void; onSave: (p: Patient) => void }) {
  const [f, setF] = useState<Form>(EMPTY)
  const [reading, setReading] = useState(false)
  const [fromMyna, setFromMyna] = useState(false)
  const [tried, setTried] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => nameRef.current?.focus(), [])
  // カナの自動入力：氏名を打つときの変換前の読み（IMEのかな）をためてカナに入れる。カナを手で直したら止める
  const kanaAuto = useRef(true)
  const kanaRead = useRef('')
  const pending = useRef('')
  const set = (patch: Partial<Form>) => setF((cur) => ({ ...cur, ...patch }))
  const setKanaAuto = (k: string) => kanaAuto.current && setF((cur) => ({ ...cur, kana: k }))
  const onName = (v: string) => {
    set({ name: v })
    if (!v) kanaRead.current = ''
    else if (isKanaOnly(v)) kanaRead.current = toKata(v)
    else if (/[\s　]$/.test(v) && !/\s$/.test(kanaRead.current)) kanaRead.current += ' '
    else return
    setKanaAuto(kanaRead.current)
  }

  const burden = f.burden ?? autoBurden(f.birth, f.type)
  const missing = [!f.name.trim() && '氏名', !f.kana.trim() && 'カナ', !f.sex && '性別', !f.birth && '生年月日'].filter(Boolean) as string[]
  const payerLen = f.type === '国保' ? 6 : 8
  const payerWarn = f.payer && f.type !== '生活保護' && f.payer.length !== payerLen ? `保険者番号は${payerLen}桁です` : ''

  const read = () => {
    setReading(true)
    setTimeout(() => {
      setF(MYNA_SAMPLES[mynaNext++ % MYNA_SAMPLES.length])
      setFromMyna(true)
      setReading(false)
    }, 800)
  }

  const save = () => {
    setTried(true)
    if (missing.length) return
    const insurance = ['国保', '後期高齢者', '生活保護'].includes(f.type) ? f.type : `${f.type} ${f.relation}`
    const insurer: Insurer = { payer: f.payer, symbol: f.symbol || undefined, number: f.number, branch: f.branch || undefined, relation: f.relation }
    onSave({
      id: `p${Date.now().toString(36)}`,
      name: f.name.trim(),
      kana: f.kana.trim(),
      sex: f.sex as '男' | '女',
      birth: f.birth,
      insurance,
      burden,
      allergies: f.allergies
        .split(/[,、，\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      status: '待ち',
      diseases: [],
      encounters: [],
      zip: f.zip || undefined,
      address: f.address || undefined,
      phone: f.phone || undefined,
      insurer: f.payer || f.number ? insurer : undefined,
      qualification: fromMyna
        ? { checkedAt: new Date().toISOString(), method: 'マイナ保険証', valid: true, burden, consent: { drugs: true, checkups: true, records: true } }
        : undefined,
      docs: [],
      labs: [],
      appointments: [{ id: uid('ap'), date: today(), time: nowSlot(), minutes: 30, purpose: '初診', status: '来院' }],
      payments: [],
    })
  }

  const input = (k: keyof Form, label: string, opt: { placeholder?: string; type?: string; className?: string; mono?: boolean; req?: boolean; transform?: (v: string) => string } = {}) => (
    <label className={`block ${opt.className ?? ''}`}>
      <span className="mb-1 block text-xs text-mist">
        {label}
        {opt.req && <span className="ml-0.5 text-error">*</span>}
      </span>
      <input
        ref={k === 'name' ? nameRef : undefined}
        type={opt.type ?? 'text'}
        value={String(f[k] ?? '')}
        onChange={(e) => {
          if (k === 'name') return onName(e.target.value)
          if (k === 'kana') kanaAuto.current = e.target.value === ''
          set({ [k]: opt.transform ? opt.transform(e.target.value) : e.target.value } as Partial<Form>)
        }}
        onCompositionUpdate={k === 'name' ? (e) => (pending.current = e.data) : undefined}
        onCompositionEnd={
          k === 'name'
            ? () => {
                if (isKanaOnly(pending.current)) {
                  kanaRead.current += toKata(pending.current)
                  setKanaAuto(kanaRead.current)
                }
                pending.current = ''
              }
            : undefined
        }
        placeholder={opt.placeholder}
        className={`field h-9 w-full px-2.5 text-sm ${opt.mono ? 'font-num' : ''} ${tried && opt.req && !f[k] ? 'border-error' : ''}`}
      />
    </label>
  )

  return (
    <Dialog label="新患登録" onClose={onClose} wide>
      <DialogHead icon="person_add" title="新患登録" sub="登録すると受付の一覧に「待ち」で入ります" onClose={onClose} />
      <form
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            save()
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-1 px-4 py-3">
          <button type="button" onClick={read} disabled={reading} className="btn btn-tonal">
            {reading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : <Icon name="id_card" size={18} />}
            {reading ? '読み取っています…' : 'マイナ保険証で読み取る'}
          </button>
          <span className="flex-1 text-xs text-mist">
            {fromMyna ? (
              <span className="flex items-center gap-1 text-[#0d6e61]">
                <Icon name="check_circle" fill size={16} />
                読み取りました（架空の応答）。電話番号とアレルギーを確認してください
              </span>
            ) : (
              '氏名・生年月日・住所・保険が入ります。カードが無ければ下に手で入力'
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {input('name', '氏名', {
            placeholder: '例：山田 太郎',
            req: true,
          })}
          {input('kana', 'カナ', { placeholder: 'ヤマダ タロウ（ひらがなで打てばカナに直します）', req: true, transform: toKata })}
          <div>
            <span className="mb-1 block text-xs text-mist">
              性別<span className="ml-0.5 text-error">*</span>
            </span>
            <div className="flex gap-1">
              {(['男', '女'] as const).map((s) => (
                <button key={s} type="button" onClick={() => set({ sex: s })} className={`chip h-9 flex-1 justify-center ${f.sex === s ? 'chip-on' : ''} ${tried && !f.sex ? 'border-error' : ''}`}>
                  {s === '男' ? '男性' : '女性'}
                </button>
              ))}
            </div>
          </div>
          <div>
            {input('birth', '生年月日', { type: 'date', req: true })}
            {f.birth && (
              <span className="mt-1 block text-xs text-mist">
                {birthLabel(f.birth)}・{age(f.birth)}歳
              </span>
            )}
          </div>
          {input('phone', '電話', { placeholder: '090-0000-0000', mono: true })}
          {input('zip', '郵便番号', { placeholder: '100-0000', mono: true })}
          {input('address', '住所', { placeholder: '東京都サンプル区…', className: 'col-span-2 max-sm:col-span-1' })}
        </div>

        <section className="space-y-2.5">
          <h3 className="border-b border-line pb-1 text-[0.8125rem] font-semibold">保険</h3>
          <div className="flex flex-wrap gap-1">
            {INSURANCE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => set({ type: t })} className={`chip h-8 ${f.type === t ? 'chip-on' : ''}`}>
                {t}
              </button>
            ))}
          </div>
          {!['国保', '後期高齢者', '生活保護'].includes(f.type) && (
            <div className="flex gap-1">
              {(['本人', '家族'] as const).map((r) => (
                <button key={r} type="button" onClick={() => set({ relation: r })} className={`chip h-8 ${f.relation === r ? 'chip-on' : ''}`}>
                  {r}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
            {input('payer', '保険者番号', { mono: true, transform: (v) => v.replace(/\D/g, '').slice(0, 8) })}
            {input('symbol', '記号', { mono: true })}
            {input('number', '番号', { mono: true })}
            {input('branch', '枝番', { mono: true, transform: (v) => v.replace(/\D/g, '').slice(0, 2) })}
          </div>
          {payerWarn && <p className="text-xs text-[#8a5a00]">{payerWarn}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-mist">負担割合</span>
            {[0.1, 0.2, 0.3].map((b) => (
              <button key={b} type="button" onClick={() => set({ burden: b })} className={`chip h-8 ${burden === b ? 'chip-on' : ''}`}>
                {pct(b)}
              </button>
            ))}
            {f.burden === null ? (
              <span className="text-[0.6875rem] text-mist">年齢から自動（仮：70歳以上は所得区分で変わります）</span>
            ) : (
              <button type="button" onClick={() => set({ burden: null })} className="text-[0.6875rem] text-clinical hover:underline">
                年齢から自動に戻す
              </button>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="border-b border-line pb-1 text-[0.8125rem] font-semibold">アレルギー</h3>
          <div className="flex items-center gap-2">
            <input value={f.allergies} onChange={(e) => set({ allergies: e.target.value })} placeholder="例：ペニシリン系（発疹）、卵　（なければ空欄）" className="field h-9 flex-1 px-2.5 text-sm" />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          {tried && missing.length > 0 && <span className="mr-auto text-xs text-error">{missing.join('・')}を入れてください</span>}
          <button type="button" onClick={onClose} className="btn btn-outlined">
            やめる
          </button>
          <button type="submit" className="btn btn-filled">
            <Icon name="how_to_reg" size={18} />
            登録して受付 <span className="kbd">⌘Enter</span>
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// 今の時刻を15分単位に切り下げた「H:MM」
const nowSlot = () => {
  const d = new Date()
  const m = Math.floor((d.getHours() * 60 + d.getMinutes()) / 15) * 15
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
