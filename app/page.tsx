'use client';

import { useState, useCallback } from 'react';
import { Search, Volume2, BookOpen, Sparkles, History, X, Brain } from 'lucide-react';
import { useWebLLM, playAudio, useHistory, langConfigs } from '@/lib/llm';

export default function Home() {
  const [input, setInput] = useState('');
  const [selectedLang, setSelectedLang] = useState<'ja' | 'en' | 'zh'>('ja');
  const [result, setResult] = useState<{
    word: string;
    meaning: string;
    sentences: Array<{ original: string; translation: string; context: string }>;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { isReady, isLoading, error, generateSentences } = useWebLLM();
  const { history, addToHistory, clearHistory } = useHistory();

  const handleSearch = useCallback(async () => {
    if (!input.trim() || !isReady) return;

    setIsSearching(true);
    const word = input.trim();

    try {
      const sentences = await generateSentences(word, selectedLang);

      if (sentences.length === 0) {
        throw new Error('無法生成例句');
      }

      setResult({
        word,
        meaning: 'Web LLM 生成',
        sentences,
      });

      addToHistory(word, selectedLang);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [input, selectedLang, isReady, generateSentences, addToHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const loadFromHistory = (word: string, lang: string) => {
    setInput(word);
    setSelectedLang(lang as 'ja' | 'en' | 'zh');
    setTimeout(() => handleSearch(), 100);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="text-center pt-8 mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            一字學習
          </h1>
          <p className="text-white/70">打一個字，學一句話</p>

          {/* Model Status */}
          <div
            className={`mt-4 flex items-center justify-center gap-2 text-sm ${
              isLoading ? 'text-yellow-400' : error ? 'text-red-400' : 'text-green-400'
            }`}
          >
            <Brain
              className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`}
            />
            <span>
              {isLoading
                ? '載入 TinyLlama 1.1B 模型中... (首次載入約 30-60 秒)'
                : error
                ? error
                : 'Web LLM 已就緒'}
            </span>
          </div>
        </header>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mb-6">
          {(['ja', 'en', 'zh'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setSelectedLang(lang);
                setResult(null);
              }}
              disabled={isLoading || !!error}
              className={`px-4 py-2 rounded-full transition-all ${
                selectedLang === lang
                  ? 'bg-white text-purple-900 font-semibold shadow-lg'
                  : 'bg-white/10 hover:bg-white/20 disabled:opacity-50'
              }`}
            >
              {langConfigs[lang].icon} {lang === 'ja' ? '日本語' : lang === 'en' ? 'English' : '中文'}
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
            disabled={!isReady}
            placeholder={langConfigs[selectedLang].placeholder}
            className="w-full px-6 py-4 pr-14 text-lg bg-white/10 backdrop-blur border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !input.trim() || !isReady}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-purple-500 hover:bg-purple-400 disabled:bg-white/10 rounded-xl transition-colors"
          >
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mb-8 bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            {/* Word Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-1">{result.word}</h2>
                  <p className="text-white/70">{result.meaning}</p>
                </div>
                <button
                  onClick={() => playAudio(result.word, selectedLang)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              </div>
              <span className="inline-block mt-3 px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                🧠 TinyLlama 1.1B 生成
              </span>
            </div>

            {/* Sentences */}
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-white/80 font-semibold mb-4">
                <BookOpen className="w-5 h-5" />
                AI 生成例句
              </h3>
              <div className="space-y-3">
                {result.sentences.map((sentence, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <span className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full mb-2">
                          {sentence.context}
                        </span>
                        <p className="text-lg mb-1">{sentence.original}</p>
                        <p className="text-white/60 text-sm">{sentence.translation}</p>
                      </div>
                      <button
                        onClick={() => playAudio(sentence.original, selectedLang)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
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
              {history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => loadFromHistory(item.word, item.lang)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <span className="opacity-50">{langConfigs[item.lang].icon}</span>
                  {item.word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-8 text-white/40 text-sm">
          <p>💡 使用 TinyLlama 1.1B 模型在瀏覽器本地生成例句</p>
          <p className="mt-1">模型首次載入約需 30-60 秒，之後即可離線使用</p>
        </footer>
      </div>
    </div>
  );
}
