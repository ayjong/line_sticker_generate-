import React, { useState, useEffect } from 'react'
import './App.css'
import { generateImageDescriptionsWithText, generateTextStyle } from './utils/gemini'
import { generateCharacter, generateMainImage, generateTabImage, generateGrid8Image } from './utils/characterGenerator'
import { splitGrid8, removeBackgroundSimple, fileToDataURL } from './utils/imageUtils'
import { downloadAsZip } from './utils/zipDownloader'

const STORAGE_KEY = 'line_sticker_api_key'

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [apiKey, setApiKey] = useState('')
  const [count, setCount] = useState(8)
  const [characterDescription, setCharacterDescription] = useState('')
  const [theme, setTheme] = useState('')
  const [uploadedCharacterImage, setUploadedCharacterImage] = useState(null)
  const [characterImage, setCharacterImage] = useState(null)
  const [characterConfirmed, setCharacterConfirmed] = useState(false)
  const [textStyle, setTextStyle] = useState('')
  const [descriptions, setDescriptions] = useState([])
  const [gridImages, setGridImages] = useState([])
  const [processedGridImages, setProcessedGridImages] = useState([])
  const [cutImages, setCutImages] = useState([])
  const [mainImage, setMainImage] = useState(null)
  const [tabImage, setTabImage] = useState(null)
  const [backgroundThreshold, setBackgroundThreshold] = useState(240)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState(false)

  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY)
    if (savedKey) setApiKey(savedKey)
  }, [])

  const saveApiKey = (key) => {
    setApiKey(key)
    localStorage.setItem(STORAGE_KEY, key)
  }

  const handleCharacterUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      setLoading(true)
      try {
        const dataUrl = await fileToDataURL(file)
        setUploadedCharacterImage(dataUrl)
        setCharacterImage(dataUrl)
        setCharacterConfirmed(true)
        setCurrentStep(5)
      } catch (err) {
        alert('上傳失敗：' + err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleGenerateCharacter = async () => {
    setLoading(true)
    setProgress('正在繪製角色藝術圖...')
    try {
      const character = await generateCharacter(apiKey, characterDescription || theme, uploadedCharacterImage)
      setCharacterImage(character)
      setCharacterConfirmed(false)
    } catch (error) {
      alert(`生成失敗: ${error.message}`)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleGenerateDescriptions = async () => {
    setLoading(true)
    setProgress('AI 正在構思創意貼圖內容...')
    try {
      const items = await generateImageDescriptionsWithText(apiKey, theme, textStyle || '可愛風格', count)
      setDescriptions(items)
      setCurrentStep(6)
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleGenerateStickers = async () => {
    setLoading(true)
    setProgress('開始繪製貼圖原稿，請稍候...')
    try {
      const gridCount = Math.ceil(count / 8)
      const allGrid = []
      for (let i = 0; i < gridCount; i++) {
        setProgress(`正在繪製第 ${i + 1}/${gridCount} 張畫板...`)
        const stickers = descriptions.slice(i * 8, (i + 1) * 8)
        while (stickers.length < 8) stickers.push({ description: '', text: '' })
        const grid = await generateGrid8Image(apiKey, characterImage, stickers, textStyle)
        allGrid.push(grid)
      }
      setGridImages(allGrid)
      const processed = await Promise.all(allGrid.map(img => removeBackgroundSimple(img, backgroundThreshold)))
      setProcessedGridImages(processed)
      setCurrentStep(7)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleSliceAndFinish = async () => {
    setLoading(true)
    setProgress('精準裁切與生成系統圖標...')
    try {
      const allCut = []
      for (const img of processedGridImages) {
        const cells = await splitGrid8(img, 370, 320)
        allCut.push(...cells)
      }
      setCutImages(allCut.slice(0, count))

      const [main, tab] = await Promise.all([
        generateMainImage(apiKey, characterImage, theme).then(i => removeBackgroundSimple(i, backgroundThreshold)),
        generateTabImage(apiKey, characterImage, theme).then(i => removeBackgroundSimple(i, backgroundThreshold))
      ])
      setMainImage(main)
      setTabImage(tab)
      setCurrentStep(8)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (loginPassword === '800611') {
      setIsAuthenticated(true)
      setLoginError(false)
    } else {
      setLoginError(true)
      setLoginPassword('')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <div className="login-icon">🛡️</div>
          <h2>系統認證</h2>
          <p>請輸入密碼以進入 ✨ LINE 貼圖大師</p>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className={`form-input ${loginError ? 'error' : ''}`}
                placeholder="請輸入進入密碼"
                autoFocus
              />
              {loginError && <p className="error-text">❌ 密碼錯誤，請重新輸入</p>}
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{ width: '100%' }}>進入系統</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 className="title" style={{ margin: 0 }}>✨ LINE 貼圖大師</h1>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            if (window.confirm('確定要重置專案嗎？所有生成的內容將會消失。')) {
              setCurrentStep(apiKey ? 2 : 1)
              setCount(8)
              setCharacterDescription('')
              setTheme('')
              setUploadedCharacterImage(null)
              setCharacterImage(null)
              setCharacterConfirmed(false)
              setTextStyle('')
              setDescriptions([])
              setGridImages([])
              setProcessedGridImages([])
              setCutImages([])
              setMainImage(null)
              setTabImage(null)
            }
          }}>重置專案</button>
        </div>

        {/* Modern Stepper Navigation */}
        <div className="stepper">
          {[
            { id: 1, title: 'API', desc: '輸入金鑰' },
            { id: 2, title: '數量', desc: '張數設定' },
            { id: 3, title: '主題', desc: '內容描述' },
            { id: 4, title: '形象', desc: '角色預覽' },
            { id: 5, title: '文案', desc: '描述生成' },
            { id: 6, title: '校改', desc: '文字編輯' },
            { id: 7, title: '去背', desc: '效果調整' },
            { id: 8, title: '打包', desc: '完成下載' }
          ].map(s => (
            <div key={s.id} className={`step ${currentStep === s.id ? 'active' : ''} ${currentStep > s.id ? 'done' : ''}`}>
              <div className="step-header">{currentStep > s.id ? '✓' : s.id}</div>
              <div className="step-info">
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {currentStep === 1 && (
          <div className="step-section">
            <h2>🔑 設定 API Key</h2>
            <input type="password" value={apiKey} onChange={e => saveApiKey(e.target.value)} className="form-input" placeholder="Gemini API Key..." />
            <button className="btn btn-primary" onClick={() => apiKey ? setCurrentStep(2) : alert('請輸入 Key')} style={{ marginTop: '20px' }}>下一步</button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-section">
            <h2>🎨 貼圖數量</h2>
            <select value={count} onChange={e => setCount(Number(e.target.value))} className="form-input">
              {[8, 16, 24, 32, 40].map(v => <option key={v} value={v}>{v} 張</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => setCurrentStep(3)} style={{ marginTop: '20px' }}>下一步</button>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-section">
            <h2>💡 主題設定</h2>
            <div className="form-group">
              <label>主題描述</label>
              <textarea value={theme} onChange={e => setTheme(e.target.value)} className="form-input" placeholder="如：很派的柴犬..." />
            </div>
            <div className="form-group">
              <label>上傳角色 (選填)</label>
              <input type="file" onChange={handleCharacterUpload} className="form-input" />
            </div>
            <button className="btn btn-primary" onClick={() => setCurrentStep(4)}>設計角色</button>
          </div>
        )}

        {currentStep === 4 && (
          <div className="step-section">
            <h2>🖼️ 角色預覽</h2>
            {!characterImage ? (
              <button className="btn btn-primary" onClick={handleGenerateCharacter}>AI 生成角色</button>
            ) : (
              <div className="character-preview">
                <img src={characterImage} alt="Preview" />
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button className="btn btn-success" onClick={() => setCurrentStep(5)}>確定，繼續</button>
                  <button className="btn btn-secondary" onClick={handleGenerateCharacter}>重新生成</button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="step-section">
            <h2>✍️ 內容生成</h2>
            <button className="btn btn-primary" onClick={handleGenerateDescriptions}>生成貼圖文案</button>
          </div>
        )}

        {currentStep === 6 && (
          <div className="step-section">
            <h2>📝 編輯文案</h2>
            <div className="descriptions-editor" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
              {descriptions.map((d, i) => (
                <div key={i} className="description-item">
                  <input value={d.text} onChange={e => {
                    const n = [...descriptions]; n[i].text = e.target.value; setDescriptions(n);
                  }} className="form-input" />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleGenerateStickers}>🚀 繪製貼圖原稿</button>
          </div>
        )}

        {currentStep === 7 && (
          <div className="step-section">
            <h2>🧹 去背調整</h2>
            <input type="range" min="200" max="255" value={backgroundThreshold} onChange={e => setBackgroundThreshold(e.target.value)} className="threshold-slider" />
            <button className="btn btn-primary" onClick={handleSliceAndFinish} style={{ marginTop: '20px' }}>裁切並打包</button>
          </div>
        )}

        {currentStep === 8 && (
          <div className="step-section">
            <h2>📦 下載貼圖</h2>
            <div className="sticker-grid">
              {cutImages.map((img, i) => <img key={i} src={img} className="sticker-image" />)}
            </div>
            <button className="btn btn-success btn-download" onClick={() => downloadAsZip(cutImages.map((img, i) => ({ index: i + 1, dataUrl: img })), mainImage, tabImage, theme)}>
              下載 ZIP 打包檔
            </button>
          </div>
        )}

        {progress && <div className="progress">{progress}</div>}
      </div>
    </div>
  )
}

export default App
