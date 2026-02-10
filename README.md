# Lang Learn 一字學習

打一個字，學一句話 — 使用 Web LLM (TinyLlama 1.1B) 在瀏覽器本地生成自然例句

## 功能特點

- 🤖 **Web LLM 生成例句** - 使用 TinyLlama 1.1B 模型在瀏覽器本地運行
- 🌐 **支援多語言** - 日文 🇯🇵、英文 🇬🇧、中文 🇹🇼
- 🎯 **5 種語境** - 日常對話、工作場景、情感表達、描述事物、請求幫助
- 🔊 **語音朗讀** - 使用 Web Speech API
- 📚 **歷史記錄** - 自動保存查詢歷史
- 🔒 **隱私保護** - 所有數據本地處理，不上傳服務器

## 本地運行

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發服務器
npm run dev

# 3. 打開 http://localhost:3000
```

## 技術架構

- **框架**: Next.js 14 + React 18 + TypeScript
- **樣式**: Tailwind CSS
- **AI**: TinyLlama 1.1B (via Transformers.js)
- **推理**: WebGPU / WebGL (瀏覽器本地)

## 注意事項

1. **首次載入** - 模型約 600MB，首次載入需要 30-60 秒
2. **瀏覽器支援** - 需要支援 WebGPU 的瀏覽器 (Chrome 113+、Edge 113+)
3. **內存需求** - 建議 4GB+ 可用內存

## 推送到 GitHub

```bash
# 如果你在本地 clone 了這個項目
git remote add origin https://github.com/tomcheung99/Lang-Learn.git
git push -u origin master
```

或創建新 repository：
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/Lang-Learn.git
git push -u origin master
```

## License

MIT
