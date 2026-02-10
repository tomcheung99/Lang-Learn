"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Volume2, BookOpen, Sparkles, History, X, Globe, Brain } from "lucide-react";
import { pipeline, TextGenerationPipeline } from "@huggingface/transformers";

// Web LLM 例句生成器
class WebLLMGenerator {
  private generator: TextGenerationPipeline | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  async load() {
    if (this.generator) return;
    if (this.loadPromise) return this.loadPromise;
    
    this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  private async doLoad() {
    this.isLoading = true;
    try {
      // 使用 TinyLlama 1.1B - 適合瀏覽器的小模型
      this.generator = await pipeline(
        "text-generation",
        "onnx-community/TinyLlama-1.1B-Chat-v1.0",
        {
          dtype: "q4f16", // 4-bit 量化，減少內存使用
          device: "webgpu", // 使用 WebGPU 加速 (如果可用)
        }
      );
    } catch (e) {
      // 如果 WebGPU 失敗，回退到 CPU
      this.generator = await pipeline(
        "text-generation",
        "onnx-community/TinyLlama-1.1B-Chat-v1.0",
        {
          dtype: "q4f16",
          device: "cpu",
        }
      );
    }
    this.isLoading = false;
  }

  async generateSentences(word: string, lang: string, meaning: string): Promise<Array<{
    original: string;
    translation: string;
    context: string;
  }>> {
    await this.load();
    if (!this.generator) throw new Error("Model not loaded");

    const prompts = this.createPrompts(word, lang, meaning);
    const sentences: Array<{ original: string; translation: string; context: string }> = [];

    for (const { prompt, context } of prompts) {
      try {
        const output = await this.generator(prompt, {
          max_new_tokens: 100,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false,
        });

        const generated = output[0]?.generated_text?.trim() || "";
        const cleanSentence = this.cleanOutput(generated, word);
        
        if (cleanSentence && cleanSentence.length > 5) {
          const translation = await this.translate(cleanSentence, lang);
          sentences.push({
            original: cleanSentence,
            translation,
            context,
          });
        }
      } catch (e) {
        console.error("Generation failed:", e);
      }
    }

    return sentences.slice(0, 5); // 返回最多 5 句
  }

  private createPrompts(word: string, lang: string, meaning: string): Array<{ prompt: string; context: string }> {
    const contexts = [
      { name: "日常對話", desc: "daily conversation" },
      { name: "工作場景", desc: "work situation" },
      { name: "情感表達", desc: "emotional expression" },
      { name: "描述事物", desc: "describing something" },
      { name: "請求幫助", desc: "asking for help" },
    ];

    return contexts.map(({ name, desc }) => {
      let prompt = "";
      
      if (lang === "ja") {
        prompt = `<|system|>
你是一個日語教學助手。請用「${word}」(${meaning}) 生成一個自然的日文例句，語境是${desc}。只輸出例句本身，不要解釋。
<|user|>
請給我一個${desc}的例句。
<|assistant|>`;
      } else if (lang === "zh") {
        prompt = `<|system|>
你是一個中文教學助手。請用「${word}」(${meaning}) 生成一個自然的中文例句，語境是${desc}。只輸出例句本身，不要解釋。
<|user|>
請給我一個${desc}的例句。
<|assistant|>`;
      } else {
        prompt = `<|system|>
You are an English teaching assistant. Please generate a natural English sentence using "${word}" (${meaning}) in the context of ${desc}. Output only the sentence, no explanation.
<|user|>
Give me a sentence about ${desc}.
<|assistant|>`;
      }

      return { prompt, context: name };
    });
  }

  private cleanOutput(text: string, word: string): string {
    // 清理模型輸出
    let cleaned = text
      .replace(/<\|.*\|>/g, "") // 移除特殊標記
      .replace(/^(例句：|Sentence:|Example:)/i, "")
      .replace(/[\n\r]/g, " ")
      .trim();

    // 確保包含目標單字
    if (!cleaned.includes(word)) {
      return "";
    }

    // 限制長度
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100) + "...";
    }

    return cleaned;
  }

  private async translate(text: string, fromLang: string): Promise<string> {
    // 使用 MyMemory API 進行翻譯
    try {
      const from = fromLang === "ja" ? "ja" : fromLang === "zh" ? "zh" : "en";
      const to = fromLang === "en" ? "zh" : "en";
      
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
      );
      const data = await response.json();
      return data.responseData?.translatedText || "";
    } catch {
      return "(翻譯失敗)";
    }
  }

  isReady() {
    return !!this.generator;
  }
}

// 單例模式
const llmGenerator = new WebLLMGenerator();

// 本地數據庫 (常用詞彙的基礎信息)
const localDatabase: Record<string, Record<string, { meaning: string; reading?: string; pos?: string }>> = {
  ja: {
    "愛": { meaning: "愛、愛情", reading: "あい (ai)", pos: "noun" },
    "夢": { meaning: "夢想、夢境", reading: "ゆめ (yume)", pos: "noun" },
    "時間": { meaning: "時間", reading: "じかん (jikan)", pos: "noun" },
    "猫": { meaning: "貓", reading: "ねこ (neko)", pos: "noun" },
    "本": { meaning: "書", reading: "ほん (hon)", pos: "noun" },
    "食べる": { meaning: "吃", reading: "たべる (taberu)", pos: "verb" },
    "行く": { meaning: "去", reading: "いく (iku)", pos: "verb" },
    "良い": { meaning: "好的", reading: "よい (yoi)", pos: "adjective" },
  },
  en: {
    "love": { meaning: "愛、愛情", pos: "noun" },
    "time": { meaning: "時間", pos: "noun" },
    "dream": { meaning: "夢想、夢境", pos: "noun" },
    "eat": { meaning: "吃", pos: "verb" },
    "go": { meaning: "去", pos: "verb" },
    "beautiful": { meaning: "美麗的", pos: "adjective" },
  },
  zh: {
    "愛": { meaning: "love, affection", reading: "ài", pos: "noun" },
    "夢": { meaning: "dream", reading: "mèng", pos: "noun" },
    "時間": { meaning: "time", reading: "shí jiān", pos: "noun" },
    "吃": { meaning: "eat", reading: "chī", pos: "verb" },
    "去": { meaning: "go", reading: "qù", pos: "verb" },
    "漂亮": { meaning: "beautiful", reading: "piào liang", pos: "adjective" },
  },
};

export default function LangLearn() {
  const [input, setInput] = useState("");
  const [selectedLang, setSelectedLang] = useState<"ja" | "en" | "zh">("ja");
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ word: string; lang: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入歷史記錄
  useEffect(() => {
    const saved = localStorage.getItem("lang-learn-history");
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  // 保存歷史記錄
  useEffect(() => {
    localStorage.setItem("lang-learn-history", JSON.stringify(history));
  }, [history]);

  // 預載入模型
  useEffect(() => {
    const preload = async () => {
      setIsLoadingModel(true);
      try {
        await llmGenerator.load();
        setModelReady(true);
      } catch (e) {
        console.error("Model load failed:", e);
        setError("模型載入失敗，請刷新頁面重試");
      } finally {
        setIsLoadingModel(false);
      }
    };
    preload();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!input.trim() || !modelReady) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const word = input.trim();
      
      // 獲取本地數據庫信息
      const localData = localDatabase[selectedLang]?.[word];
      const meaning = localData?.meaning || "";
      const reading = localData?.reading || "";
      
      // 使用 Web LLM 生成例句
      const sentences = await llmGenerator.generateSentences(word, selectedLang, meaning || word);
      
      if (sentences.length === 0) {
        setError("無法生成例句，請嘗試其他單字");
        setIsSearching(false);
        return;
      }
      
      setResult({
        word,
        meaning: meaning || "(Web LLM 生成)",
        reading,
        sentences,
      });
      
      // 添加到歷史
      setHistory(prev => {
        const filtered = prev.filter(h => !(h.word === word && h.lang === selectedLang));
        return [{ word, lang: selectedLang }, ...filtered].slice(0, 20);
      });
    } catch (err) {
      setError("生成時發生錯誤，請重試");
    } finally {
      setIsSearching(false);
    }
  }, [input, selectedLang, modelReady]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const playAudio = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLang === "ja" ? "ja-JP" : selectedLang === "zh" ? "zh-TW" : "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("lang-learn-history");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center pt-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            <Sparkles className="inline-block w-8 h-8 mr-2 text-yellow-400" />
            一字學習
          </h1>
          <p className="text-purple-200">打一個字，學一句話</p>
          
          {/* Model Status */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <Brain className={`w-4 h-4 ${isLoadingModel ? "animate-pulse text-yellow-400" : modelReady ? "text-green-400" : "text-red-400"}`} />
            <span className={`text-xs ${isLoadingModel ? "text-yellow-400" : modelReady ? "text-green-400" : "text-red-400"}`}>
              {isLoadingModel ? "載入 TinyLlama 1.1B 模型中... (首次載入約 30-60 秒)" : 
               modelReady ? "Web LLM 已就緒" : "模型載入失敗"}
            </span>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mb-6">
          {([
            { code: "ja", label: "日本語", emoji: "🇯🇵" },
            { code: "en", label: "English", emoji: "🇬🇧" },
            { code: "zh", label: "中文", emoji: "🇹🇼" },
          ] as const).map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setSelectedLang(lang.code);
                setResult(null);
              }}
              disabled={isLoadingModel}
              className={`px-4 py-2 rounded-full transition-all disabled:opacity-50 ${
                selectedLang === lang.code
                  ? "bg-white text-purple-900 font-semibold shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {lang.emoji} {lang.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative mb-8">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!modelReady || isLoadingModel}
            placeholder={selectedLang === "ja" ? "輸入日文..." : selectedLang === "zh" ? "輸入中文..." : "Type English..."}
            className="w-full px-6 py-4 pr-14 text-lg bg-white/10 backdrop-blur border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !input.trim() || !modelReady}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-purple-500 hover:bg-purple-400 disabled:bg-white/10 rounded-xl transition-colors"
          >
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-center">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-8 bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Word Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">{result.word}</h2>
                  {result.reading && (
                    <p className="text-purple-300 text-lg">{result.reading}</p>
                  )}
                  <p className="text-white/70 mt-2">{result.meaning}</p>
                </div>
                <button
                  onClick={() => playAudio(result.word)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                  title="播放讀音"
                >
                  <Volume2 className="w-6 h-6 text-white" />
                </button>
              </div>
              <span className="inline-block mt-3 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                🧠 TinyLlama 1.1B 生成
              </span>
            </div>

            {/* Sentences */}
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-white/80 font-semibold mb-4">
                <BookOpen className="w-5 h-5" />
                AI 生成例句 ({result.sentences.length} 句)
              </h3>
              <div className="space-y-3">
                {result.sentences.map((sentence: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                            {sentence.context}
                          </span>
                        </div>
                        <p className="text-white text-lg mb-1">{sentence.original}</p>
                        <p className="text-white/60 text-sm">{sentence.translation}</p>
                      </div>
                      <button
                        onClick={() => playAudio(sentence.original)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                        title="播放例句"
                      >
                        <Volume2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-white/80 font-semibold">
                <History className="w-4 h-4" />
                最近查詢
              </h3>
              <button
                onClick={clearHistory}
                className="text-white/40 hover:text-white/60 text-sm flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                清除
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={`${item.word}-${item.lang}`}
                  onClick={() => {
                    setInput(item.word);
                    setSelectedLang(item.lang as any);
                    setTimeout(() => handleSearch(), 100);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <Globe className="w-3 h-3 opacity-50" />
                  {item.word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-white/30 text-sm">
            💡 使用 TinyLlama 1.1B 模型在瀏覽器本地生成例句
          </p>
          <p className="text-white/20 text-xs mt-2">
            模型首次載入約需 30-60 秒，之後即可離線使用
          </p>
        </div>
      </div>
    </div>
  );
}
