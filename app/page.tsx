'use client';

import { useState, useCallback } from 'react';
import { Search, Volume2, BookOpen, Sparkles, History, X, Sun, Moon, Loader2 } from 'lucide-react';
import { useWebLLM, playAudio, useHistory, useTheme, langConfigs } from '@/lib/llm';

export default function Home() {
  const [input, setInput] = useState('');
  const [selectedLang, setSelectedLang] = useState<'ja' | 'en' | 'zh'>('ja');
  const [result, setResult] = useState<{
    word: string;
    meaning: string;
    sentences: Array<{ original: string; translation: string; context: string }>;
  } | null>(null);
  
  const { isLoading, generateSentences } = useWebLLM();
  const { history, addToHistory, clearHistory, isClient } = useHistory();
  const { theme, toggleTheme, mounted } = useTheme();

  const handleSearch = useCallback(async () => {
    if (!input.trim()) return;

    const word = input.trim();
    const sentences = await generateSentences(word, selectedLang);

    if (sentences.length === 0) return;

    setResult({
      word,
      meaning: 'AI 智能生成',
      sentences,
    });

    addToHistory(word, selectedLang);
  }, [input, selectedLang, generateSentences, addToHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const loadFromHistory = (word: string, lang: string) => {
    setInput(word);
    setSelectedLang(lang as 'ja' | 'en' | 'zh');
    setTimeout(() => handleSearch(), 100);
  };

  // 防止 hydration 錯誤
  if (!mounted || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen neural-bg transition-theme">
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Sparkles className="w-10 h-10 animate-pulse-slow" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-current animate-bounce-slow" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              一字學習
            </h1>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
          
          <p className="text-[var(--text-secondary)] text-lg">
            打一個字，學一句話
          </p>
          
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI 模板引擎就緒
          </div>
        </header>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(['ja', 'en', 'zh'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setSelectedLang(lang);
                setResult(null);
              }}
              className={`px-5 py-2.5 rounded-full font-medium transition-all duration-200 ${
                selectedLang === lang
                  ? 'bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg'
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <span className="mr-2">{langConfigs[lang].icon}</span>
              {langConfigs[lang].name}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative mb-8 group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/20 to-gray-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={langConfigs[selectedLang].placeholder}
            className="relative w-full px-6 py-4 pr-14 text-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl 
                       placeholder-[var(--text-tertiary)] 
                       focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20
                       transition-all duration-200"
          />
          
          <button
            onClick={handleSearch}
            disabled={isLoading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 
                       bg-[var(--accent)] text-[var(--bg-primary)] rounded-xl
                       hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="mb-8 p-8 bg-[var(--card)] border border-[var(--border)] rounded-2xl animate-fade-in">
            <div className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-12 h-12 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-5 h-5 animate-pulse" />
              </div>
              
              <div className="text-center"
            >
                <p className="font-medium mb-2">AI 正在生成例句...</p>
                <div className="flex gap-1 justify-center"
              >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="w-full max-w-xs space-y-2"
            >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-[var(--bg-secondary)] rounded-lg animate-pulse"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div className="mb-8 bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden animate-slide-up shadow-lg"
          >
            {/* Word Header */}
            <div className="p-6 border-b border-[var(--border)]"
          >
              <div className="flex items-start justify-between"
        >
                <div>
                  <div className="flex items-center gap-3 mb-2"
              >
                    <h2 className="text-3xl md:text-4xl font-bold">{result.word}</h2>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {langConfigs[selectedLang].name}
                    </span>
                  </div>
                  
                  <p className="text-[var(--text-secondary)]">{result.meaning}</p>
                </div>
                
                <button
                  onClick={() => playAudio(result.word, selectedLang)}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] 
                             transition-colors group"
                >
                  <Volume2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            {/* Sentences */}
            <div className="p-6"
        >
              <h3 className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold mb-5"
      >
                <BookOpen className="w-5 h-5" />
                例句 ({result.sentences.length})
              </h3>
              
              <div className="space-y-4"
    >
                {result.sentences.map((sentence, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[var(--bg-secondary)] rounded-xl hover:bg-[var(--bg-tertiary)] 
                               transition-all duration-200 group animate-fade-in"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between gap-4"
  >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3"
>
                          <span className="px-3 py-1 text-xs font-medium rounded-full 
                                           bg-[var(--accent)]/10 text-[var(--accent)]"
                          >
                            {sentence.context}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            #{idx + 1}
                          </span>
                        </div>
                        
                        <p className="text-lg font-medium mb-2 leading-relaxed">{sentence.original}</p>
                        <p className="text-[var(--text-secondary)] text-sm">{sentence.translation}</p>
                      </div>
                      
                      <button
                        onClick={() => playAudio(sentence.original, selectedLang)}
                        className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)]
                                   opacity-0 group-hover:opacity-100 transition-all duration-200"
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
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold"
>
                <History className="w-4 h-4" />
                最近查詢
              </h3>
              
              <button
                onClick={clearHistory}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] 
                           flex items-center gap-1 transition-colors"
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
                  className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] 
                             rounded-lg text-sm transition-all duration-200
                             flex items-center gap-2 group"
                >
                  <span className="opacity-50">{langConfigs[item.lang].icon}</span>
                  <span>{item.word}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-[var(--text-tertiary)] text-sm">
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            使用 AI 模板引擎生成自然例句
          </p>
          <p className="mt-2">支援：日文 🇯🇵 | 英文 🇬🇧 | 中文 🇹🇼</p>
        </footer>
      </div>
    </div>
  );
}
