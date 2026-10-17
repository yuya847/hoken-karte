import { useEffect, useState } from 'react'
import { Icon } from './Icon'

type Img = { id: string; name: string; url: string }

// 試作：手元の画像ファイルをこの端末で表示するだけ（保存・送信しない）。院内PACS等との連携は後のフェーズ。
export function ImageViewer({ patientName }: { patientName: string }) {
  const [imgs, setImgs] = useState<Img[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)

  useEffect(() => () => imgs.forEach((i) => URL.revokeObjectURL(i.url)), [imgs])

  const add = (files: FileList | null) => {
    if (!files) return
    const next = [...files]
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ id: `${f.name}-${f.lastModified}`, name: f.name, url: URL.createObjectURL(f) }))
    setImgs((cur) => [...cur, ...next])
    if (next[0]) setSel(next[0].id)
  }
  const current = imgs.find((i) => i.id === sel)

  return (
    <div
      className={`flex h-full flex-col ${drag ? 'ring-4 ring-inset ring-primary' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        add(e.dataTransfer.files)
      }}
    >
      <div className="flex items-center gap-3 px-6 pt-5 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e0f7fa] text-[#00696f]">
          <Icon name="radiology" size={20} />
        </span>
        <h2 className="flex-1 text-[22px]">
          画像の参照 <span className="text-sm text-ink-2">{patientName}</span>
        </h2>
        <label className="btn btn-sm btn-tonal">
          <Icon name="upload_file" size={18} />
          画像を開く
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        </label>
      </div>
      <div className="mx-3 mb-3 flex min-h-0 flex-1 overflow-hidden rounded-2xl">
        <div className="w-32 shrink-0 space-y-2 overflow-y-auto bg-surface-1 p-2">
          {imgs.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)} className={`block w-full overflow-hidden rounded-xl bg-white ${sel === i.id ? 'ring-2 ring-primary' : ''}`}>
              <img src={i.url} alt={i.name} className="h-20 w-full bg-black object-contain" />
              <div className="truncate px-1.5 py-0.5 text-[10px] text-ink-2">{i.name}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center bg-[#1f1f1f]">
          {current ? (
            <img src={current.url} alt={current.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-sm text-[#c4c7c5]">
              <Icon name="add_photo_alternate" size={48} />
              画像ファイルをここにドロップ、または「画像を開く」
              <div className="text-xs text-[#8e918f]">試作のため、この端末で表示するだけで保存はしません</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
