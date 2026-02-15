import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * 使用 Gemini 3 Pro Image Preview 模型生成 LINE 貼圖風格的圖片
 * 
 * @param {string} apiKey - Gemini API Key
 * @param {string} description - 圖片描述
 * @param {string} theme - 主題
 * @param {number} index - 圖片索引
 * @param {number} width - 圖片寬度（預設 370px，LINE 貼圖最大尺寸）
 * @param {number} height - 圖片高度（預設 320px，LINE 貼圖最大尺寸）
 * @returns {Promise<string>} 圖片 Data URL
 */
export async function generateStickerImage(apiKey, description, theme, index = 0, width = 370, height = 320) {
  try {
    return await generateImageWithGemini(apiKey, description, theme, index, width, height)
  } catch (error) {
    console.error('圖片生成錯誤，使用備用方案:', error)
    // 如果 API 調用失敗，回退到 Canvas 生成
    return await generateStickerImageFallback(description, theme, index, width, height)
  }
}

/**
 * 使用 Gemini 3 Pro Image Preview 生成圖片
 */
async function generateImageWithGemini(apiKey, description, theme, index, width, height) {
  // 直接使用 REST API，因為圖片生成可能需要專門的端點
  return await generateImageViaREST(apiKey, description, theme, index, width, height)
}

/**
 * 使用 REST API 調用 Gemini 圖片生成
 * 使用 gemini-3-pro-image-preview 模型
 */
async function generateImageViaREST(apiKey, description, theme, index, width, height) {
  // 構建適合 LINE 貼圖的詳細 prompt
  const aspectRatio = width / height
  const prompt = `Create a LINE sticker style image.

Theme: ${theme}
Description: ${description}
${index > 0 ? `Sticker number: ${index}` : 'This is a main/tab image'}

Requirements:
- Cute and simple LINE sticker style (Kawaii style)
- Transparent background (PNG format with alpha channel)
- Character consistency if it's a character series
- Clear and readable text if text is included in the description
- Exact dimensions: ${width}px width × ${height}px height
- Aspect ratio: ${aspectRatio.toFixed(2)}
- Style: Minimalist, expressive, suitable for LINE stickers
- High quality, professional illustration
- No background, transparent PNG format

Generate the image exactly as specified with transparent background.`
  
  try {
    // 使用 Google Generative AI 的圖片生成 REST API 端點
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || response.statusText
      console.error('API 錯誤詳情:', errorData)
      throw new Error(`API 錯誤 (${response.status}): ${errorMessage}`)
    }

    const data = await response.json()
    console.log('API 回應:', data)
    
    // 解析回應中的圖片數據
    // 可能的回應格式：
    // 1. candidates[0].content.parts[].inlineData (base64 圖片數據)
    // 2. candidates[0].content.parts[].image (圖片 URL 或數據)
    
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0]
      
      // 檢查 content.parts
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // 檢查內聯圖片數據
          if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
          }
          // 檢查圖片 URL
          if (part.image && part.image.url) {
            // 如果是 URL，需要下載圖片並轉換為 base64
            const imageResponse = await fetch(part.image.url)
            const blob = await imageResponse.blob()
            return await blobToDataURL(blob)
          }
        }
      }
      
      // 檢查是否有直接的圖片數據
      if (candidate.imageData) {
        return `data:image/png;base64,${candidate.imageData}`
      }
    }

    // 如果標準格式沒有圖片，嘗試其他可能的格式
    if (data.images && data.images.length > 0) {
      const imageData = data.images[0]
      if (imageData.base64) {
        return `data:image/png;base64,${imageData.base64}`
      }
      if (imageData.url) {
        const imageResponse = await fetch(imageData.url)
        const blob = await imageResponse.blob()
        return await blobToDataURL(blob)
      }
    }

    throw new Error('API 回應中沒有找到圖片數據。回應格式: ' + JSON.stringify(data).substring(0, 500))
  } catch (error) {
    console.error('REST API 調用失敗:', error)
    throw error
  }
}

/**
 * 將 Blob 轉換為 Data URL
 */
async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Canvas 備用生成方案（當 API 不可用時）
 */
async function generateStickerImageFallback(description, theme, index = 0, width = 370, height = 320) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // 設置透明背景
    ctx.clearRect(0, 0, width, height)

    // 繪製可愛的背景圓形（模擬貼圖風格）
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.35

    // 繪製主圓形背景（淺色，半透明）
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    gradient.addColorStop(0, 'rgba(255, 182, 193, 0.3)')
    gradient.addColorStop(1, 'rgba(255, 192, 203, 0.1)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()

    // 繪製表情符號或簡單圖形（根據描述）
    const emoji = getEmojiFromDescription(description, index)
    if (emoji) {
      ctx.font = `${Math.min(width, height) * 0.3}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(emoji, centerX, centerY - 20)
    }

    // 繪製描述文字（可愛風格）
    ctx.fillStyle = '#333'
    ctx.font = `bold ${Math.min(width, height) * 0.06}px "Microsoft YaHei", Arial, sans-serif`
    ctx.textAlign = 'center'
    
    // 文字換行處理
    const words = description.split('')
    const maxWidth = width * 0.8
    const lineHeight = Math.min(width, height) * 0.08
    let y = centerY + (emoji ? 30 : 0)
    let line = ''
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i]
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && line.length > 0) {
        ctx.fillText(line, centerX, y)
        line = words[i]
        y += lineHeight
      } else {
        line = testLine
      }
    }
    if (line.length > 0) {
      ctx.fillText(line, centerX, y)
    }

    // 繪製索引標籤（如果是貼圖）
    if (index > 0) {
      const badgeSize = Math.min(width, height) * 0.12
      const badgeX = width - badgeSize - 10
      const badgeY = 10
      
      // 繪製圓角矩形標籤
      ctx.fillStyle = 'rgba(102, 126, 234, 0.8)'
      roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize * 0.7, 5)
      ctx.fill()
      
      ctx.fillStyle = 'white'
      ctx.font = `bold ${badgeSize * 0.4}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(index), badgeX + badgeSize / 2, badgeY + badgeSize * 0.35)
    }

    // 繪製邊框（虛線，表示這是佔位圖）
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    roundRect(ctx, 5, 5, width - 10, height - 10, 10)
    ctx.stroke()

    // 轉換為 Data URL
    const dataUrl = canvas.toDataURL('image/png')
    resolve(dataUrl)
  })
}

/**
 * 根據描述獲取對應的表情符號
 */
function getEmojiFromDescription(description, index) {
  const desc = description.toLowerCase()
  const emojis = {
    '開心': '😊', '高興': '😄', '快樂': '😃', '笑': '😁',
    '難過': '😢', '傷心': '😭', '哭': '😢',
    '生氣': '😠', '憤怒': '😡',
    '驚訝': '😲', '驚喜': '😱',
    '愛': '😍', '喜歡': '🥰', '愛心': '❤️',
    '讚': '👍', '好': '👌', 'ok': '👌',
    '拜拜': '👋', '再見': '👋',
    '謝謝': '🙏', '感謝': '🙏',
    '累': '😴', '睡覺': '😴', '睏': '😴',
    '餓': '🍔', '吃': '🍕', '食物': '🍰',
    '貓': '🐱', '狗': '🐶', '動物': '🐾'
  }
  
  for (const [key, emoji] of Object.entries(emojis)) {
    if (desc.includes(key)) {
      return emoji
    }
  }
  
  // 如果沒有匹配，根據索引返回不同表情
  const defaultEmojis = ['😊', '😄', '😃', '😁', '😆', '😅', '🤣', '😂']
  return defaultEmojis[index % defaultEmojis.length]
}

/**
 * 繪製圓角矩形
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

