import { useEffect, useState } from 'react'

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
      className={`flex h-full flex-col bg-white ${drag ? 'ring-4 ring-inset ring-cyan-300' : ''}`}
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
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h2 className="font-semibold">画像の参照 <span className="text-sm font-normal text-slate-500">{patientName}</span></h2>
        <label className="cursor-pointer rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
          画像を開く
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        </label>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-32 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 p-2">
          {imgs.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)} className={`block w-full overflow-hidden rounded border ${sel === i.id ? 'border-cyan-500 ring-2 ring-cyan-200' : 'border-slate-200'}`}>
              <img src={i.url} alt={i.name} className="h-20 w-full bg-black object-contain" />
              <div className="truncate px-1 text-[10px] text-slate-500">{i.name}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center bg-slate-900">
          {current ? (
            <img src={current.url} alt={current.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-center text-sm text-slate-400">
              画像ファイルをここにドロップ、または「画像を開く」
              <div className="mt-1 text-xs text-slate-500">試作のため、この端末で表示するだけで保存はしません</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
