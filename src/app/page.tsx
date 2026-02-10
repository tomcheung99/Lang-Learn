"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Volume2, BookOpen, Sparkles, History, X, Globe } from "lucide-react";
import { getWordDetails, getTranslation } from "@/lib/api";

// 本地數據庫 (常用詞彙)
const localDatabase: Record<string, Record<string, { meaning: string; reading?: string }>> = {
  ja: {
    "愛": { meaning: "愛、愛情", reading: "あい (ai)" },
    "夢": { meaning: "夢想、夢境", reading: "ゆめ (yume)" },
    "時間": { meaning: "時間", reading: "じかん (jikan)" },
    "猫": { meaning: "貓", reading: "ねこ (neko)" },
    "本": { meaning: "書", reading: "ほん (hon)" },
    "友達": { meaning: "朋友", reading: "ともだち (tomodachi)" },
    "家族": { meaning: "家人", reading: "かぞく (kazoku)" },
    "仕事": { meaning: "工作", reading: "しごと (shigoto)" },
    "学校": { meaning: "學校", reading: "がっこう (gakkou)" },
    "食べ物": { meaning: "食物", reading: "たべもの (tabemono)" },
  },
  en: {
    "serendipity": { meaning: "意外發現珍貴事物的能力" },
    "ephemeral": { meaning: "短暫的、轉瞬即逝的" },
    "love": { meaning: "愛、愛情" },
    "time": { meaning: "時間" },
    "dream": { meaning: "夢想、夢境" },
    "friend": { meaning: "朋友" },
    "family": { meaning: "家人" },
    "work": { meaning: "工作" },
    "school": { meaning: "學校" },
    "food": { meaning: "食物" },
  },
  zh: {
    "夢": { meaning: "夢想、夢境", reading: "mèng" },
    "愛": { meaning: "愛、愛情", reading: "ài" },
    "時間": { meaning: "時間", reading: "shí jiān" },
    "朋友": { meaning: "朋友", reading: "péng yǒu" },
    "家人": { meaning: "家人", reading: "jiā rén" },
    "工作": { meaning: "工作", reading: "gōng zuò" },
    "學校": { meaning: "學校", reading: "xué xiào" },
    "食物": { meaning: "食物", reading: "shí wù" },
  },
};

// 獲取讀音
function getReading(word: string, lang: string): string {
  const db = localDatabase[lang]?.[word];
  return db?.reading || "";
}

// 獲取意思
function getMeaning(word: string, lang: string): string {
  const db = localDatabase[lang]?.[word];
  return db?.meaning || "";
}

export default function LangLearn() {
  const [input, setInput] = useState("");
  const [selectedLang, setSelectedLang] = useState<"ja" | "en" | "zh">("ja");
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ word: string; lang: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
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

  const handleSearch = useCallback(async () => {
    if (!input.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const word = input.trim();
      
      // 獲取單字詳情
      const details = await getWordDetails(word, selectedLang);
      
      // 合併本地數據庫信息
      const localMeaning = getMeaning(word, selectedLang);
      const localReading = getReading(word, selectedLang);
      
      setResult({
        word,
        meaning: localMeaning || details.meaning,
        reading: localReading,
        sentences: details.sentences,
        isGenerated: details.meaning.includes("自動生成"),
      });
      
      // 添加到歷史
      setHistory(prev => {
        const filtered = prev.filter(h => !(h.word === word && h.lang === selectedLang));
        return [{ word, lang: selectedLang }, ...filtered].slice(0, 20);
      });
    } catch (err) {
      setError("搜尋時發生錯誤，請重試");
    } finally {
      setIsSearching(false);
    }
  }, [input, selectedLang]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const playAudio = (text: string) => {
    if ("speechSynthesis" in window) {
      // 停止之前的播放
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

  const loadFromHistory = (word: string, lang: string) => {
    setInput(word);
    setSelectedLang(lang as any);
    setTimeout(() => {
      handleSearch();
    }, 100);
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
              className={`px-4 py-2 rounded-full transition-all ${
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
            placeholder={selectedLang === "ja" ? "輸入日文... (例: 夢、愛、時間)" : selectedLang === "zh" ? "輸入中文... (例: 夢想、愛情)" : "Type English... (e.g., love, dream)"}
            className="w-full px-6 py-4 pr-14 text-lg bg-white/10 backdrop-blur border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !input.trim()}
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
                  {result.meaning && (
                    <p className="text-white/70 mt-2">{result.meaning}</p>
                  )}
                </div>
                <button
                  onClick={() => playAudio(result.word)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                  title="播放讀音"
                >
                  <Volume2 className="w-6 h-6 text-white" />
                </button>
              </div>
              {result.isGenerated && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                    智能生成例句
                  </span>
                  <span className="text-white/40 text-xs">已提供 8 種不同語境的例句</span>
                </div>
              )}
            </div>

            {/* Sentences */}
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-white/80 font-semibold mb-4">
                <BookOpen className="w-5 h-5" />
                例句 ({result.sentences.length} 句)
              </h3>
              <div className="space-y-3">
                {result.sentences.map((sentence: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-purple-400 font-mono">#{idx + 1}</span>
                          <p className="text-white text-lg">{sentence.original}</p>
                        </div>
                        {sentence.pronunciation && (
                          <p className="text-purple-300 text-sm mb-2 font-mono">{sentence.pronunciation}</p>
                        )}
                        <p className="text-white/60">{sentence.translation}</p>
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
                  onClick={() => loadFromHistory(item.word, item.lang)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <Globe className="w-3 h-3 opacity-50" />
                  {item.word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 text-center">
          <p className="text-white/30 text-sm">
            💡 輸入任意單字，獲取 8 種不同語境的例句
          </p>
          <p className="text-white/20 text-xs mt-2">
            支援：日文 🇯🇵 | 英文 🇬🇧 | 中文 🇹🇼
          </p>
        </div>
      </div>
    </div>
  );
}
