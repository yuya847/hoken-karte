// オーダーアイコンを Gemini API の画像生成で作り、src/assets/icons/<id>.png に保存する。
// 使い方: GEMINI_API_KEY=... node scripts/gen-icons.mjs [id ...]
//   モデルは GEMINI_IMAGE_MODEL で変更できる（既定 gemini-2.5-flash-image）。
// 送るのはアイコンの説明文だけ。患者データは送らない。
import { mkdir, writeFile } from 'node:fs/promises'

const key = process.env.GEMINI_API_KEY
if (!key) {
  console.error('GEMINI_API_KEY が設定されていません')
  process.exit(1)
}
const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'

const STYLE =
  'A single flat app icon for a medical records application. Square 1:1, one simple centered symbol, ' +
  'soft rounded-square background filling the whole canvas, minimal geometric style, two or three colors, ' +
  'no text, no letters, no border, no shadow, high contrast, legible at 40 pixels.'

const ICONS = {
  rx: 'Symbol: a white capsule pill and a small prescription pad. Background: emerald green #10b981.',
  test: 'Symbol: a white laboratory test tube with a drop of blood. Background: violet #8b5cf6.',
  disease: 'Symbol: a white clipboard with a stethoscope. Background: blue #3b82f6.',
  letter: 'Symbol: a white envelope with a small medical cross on it. Background: orange #f97316.',
  image: 'Symbol: a white chest X-ray film showing ribs. Background: cyan #06b6d4.',
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ICONS)
await mkdir(new URL('../src/assets/icons/', import.meta.url), { recursive: true })

for (const id of ids) {
  if (!ICONS[id]) {
    console.error(`不明なアイコン: ${id}`)
    continue
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${STYLE} ${ICONS[id]}` }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  })
  if (!res.ok) {
    console.error(`${id}: 失敗 ${res.status} ${(await res.text()).slice(0, 300)}`)
    continue
  }
  const json = await res.json()
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
  if (!part) {
    console.error(`${id}: 画像が返りませんでした`)
    continue
  }
  const out = new URL(`../src/assets/icons/${id}.png`, import.meta.url)
  await writeFile(out, Buffer.from(part.inlineData.data, 'base64'))
  console.log(`${id}: 保存 ${out.pathname}`)
}
