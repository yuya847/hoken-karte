import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyFontSize, loadFontSize } from './FontSize'

// 文字サイズは最初の描画の前に当てる（ちらつかないように）
applyFontSize(loadFontSize())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
