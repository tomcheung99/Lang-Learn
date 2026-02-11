'use client';

import { useState, useCallback } from 'react';
import { Search, Volume2, BookOpen, Sparkles, History, X, Sun, Moon, Loader2, Download, Cpu, ChevronDown, Settings2, Check, RefreshCw, Cloud, Monitor, Key, Eye, EyeOff } from 'lucide-react';
import { useWebLLM, useOpenRouter, playAudio, useHistory, useTheme, langConfigs, availableModels, openRouterModels, allContexts, type Sentence, type BackendMode } from '@/lib/llm';

export default function Home() {
  const [input, setInput] = useState('');
  const [selectedLang, setSelectedLang] = useState<'ja' | 'en' | 'zh'>('ja');
  const [result, setResult] = useState<{
    word: string;
    meaning: string;
    sentences: Array<{ original: string; translation: string; context: string }>;
  } | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<string[]>(
    allContexts.slice(0, 5).map(c => c.id)
  );
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [backendMode, setBackendMode] = useState<BackendMode>('webllm');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  const webllm = useWebLLM();
  const openrouter = useOpenRouter();

  // 統一後端介面
  const backend = backendMode === 'webllm' ? {
    isReady: webllm.isReady,
    isLoading: webllm.isLoading,
    isGenerating: webllm.isGenerating,
    progress: webllm.progress,
    error: webllm.error,
    currentModel: webllm.currentModel,
    loadingModelName: webllm.loadingModelName,
    generateSentences: webllm.generateSentences,
    regenerateSingle: webllm.regenerateSingle,
  } : {
    isReady: openrouter.isReady,
    isLoading: openrouter.isLoading,
    isGenerating: openrouter.isGenerating,
    progress: openrouter.progress,
    error: openrouter.error,
    currentModel: openrouter.currentModel,
    loadingModelName: openrouter.loadingModelName,
    generateSentences: openrouter.generateSentences,
    regenerateSingle: openrouter.regenerateSingle,
  };

  const { isReady, isLoading, isGenerating, progress, error, currentModel, loadingModelName } = backend;
  const { history, addToHistory, clearHistory, isClient } = useHistory();
  const { theme, toggleTheme, mounted } = useTheme();

  const currentModelConfig = backendMode === 'webllm' 
    ? availableModels.find(m => m.id === currentModel)
    : openRouterModels.find(m => m.id === currentModel);

  const handleSearch = useCallback(async () => {
    if (!input.trim() || !isReady) return;

    const word = input.trim();
    
    // 初始化 result，立即顯示卡片（空例句列表）
    setResult({
      word,
      meaning: `${currentModelConfig?.name || 'AI'} 生成`,
      sentences: [],
    });

    // 逐條回調：每生成一條就更新 UI
    const onSentence = (sentence: Sentence) => {
      setResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sentences: [...prev.sentences, sentence],
        };
      });
    };

    await backend.generateSentences(word, selectedLang, selectedContexts, onSentence);

    addToHistory(word, selectedLang);
  }, [input, selectedLang, isReady, backend.generateSentences, addToHistory, currentModelConfig, selectedContexts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const loadFromHistory = (word: string, lang: string) => {
    setInput(word);
    setSelectedLang(lang as 'ja' | 'en' | 'zh');
    setTimeout(() => handleSearch(), 100);
  };

  const handleModelChange = async (modelId: string) => {
    setShowModelSelector(false);
    setResult(null);
    await webllm.loadModel(modelId);
  };

  const toggleContext = (contextId: string) => {
    setSelectedContexts(prev => {
      if (prev.includes(contextId)) {
        // 至少保留一個
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== contextId);
      }
      return [...prev, contextId];
    });
  };

  // 重新生成單條例句
  const handleRegenerateSingle = useCallback(async (idx: number) => {
    if (!result || !isReady || isGenerating) return;
    const sentence = result.sentences[idx];
    if (!sentence) return;

    // 找到對應的 context id
    const ctx = allContexts.find(c => c.name === sentence.context);
    if (!ctx) return;

    setRegeneratingIdx(idx);
    const newSentence = await backend.regenerateSingle(result.word, selectedLang, ctx.id);
    
    if (newSentence) {
      setResult(prev => {
        if (!prev) return prev;
        const newSentences = [...prev.sentences];
        newSentences[idx] = newSentence;
        return { ...prev, sentences: newSentences };
      });
    }
    setRegeneratingIdx(null);
  }, [result, isReady, isGenerating, selectedLang, backend.regenerateSingle]);

  // 全部重新生成
  const handleRegenerateAll = useCallback(async () => {
    if (!result || !isReady || isGenerating) return;
    handleSearch();
  }, [result, isReady, isGenerating, handleSearch]);

  // 防止 hydration 錯誤
  if (!mounted || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
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
              <Sparkles className="w-10 h-10 animate-pulse-slow text-[var(--accent)]" />
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
        </header>

        {/* Backend Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => { setBackendMode('webllm'); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200
                       ${backendMode === 'webllm'
                         ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                         : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'}`}
          >
            <Monitor className="w-4 h-4" />
            <span className="text-sm font-medium">本地模型</span>
          </button>
          <button
            onClick={() => { setBackendMode('openrouter'); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200
                       ${backendMode === 'openrouter'
                         ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                         : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'}`}
          >
            <Cloud className="w-4 h-4" />
            <span className="text-sm font-medium">雲端 API</span>
          </button>
        </div>

        {/* OpenRouter API Key Input */}
        {backendMode === 'openrouter' && !openrouter.hasServerKey && (
          <div className="mb-4 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-sm font-medium">OpenRouter API Key</span>
              {openrouter.isReady && (
                <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  已設定
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput || openrouter.apiKey}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg
                             placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={() => {
                  const key = apiKeyInput || openrouter.apiKey;
                  openrouter.saveApiKey(key);
                  setApiKeyInput('');
                }}
                className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg
                           hover:opacity-90 transition-opacity"
              >
                儲存
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              免費取得：<a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-[var(--accent)] underline">openrouter.ai/keys</a>
              　Qwen 2.5 7B 價格：<span className="text-[var(--accent)]">$0.02/百萬 tokens</span>（充值 $1 可用很久）
            </p>
          </div>
        )}

        {/* Server API Key Active Message */}
        {backendMode === 'openrouter' && openrouter.hasServerKey && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              已使用伺服器端 API Key，無需手動設定
            </div>
          </div>
        )}

        {/* OpenRouter Model Selector */}
        {backendMode === 'openrouter' && openrouter.isReady && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 text-sm text-[var(--text-secondary)]">
              <Cpu className="w-4 h-4" />
              <span>選擇 API 模型</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {openRouterModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => openrouter.setOpenRouterModel(model.id)}
                  className={`p-3 rounded-xl text-left transition-all
                             ${currentModel === model.id
                               ? 'bg-[var(--accent)]/10 border-2 border-[var(--accent)]'
                               : 'bg-[var(--card)] border-2 border-[var(--border)] hover:border-[var(--text-tertiary)]'}`}
                >
                  <div className="font-medium text-sm mb-1">{model.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] mb-1">{model.description}</div>
                  <div className="text-xs text-[var(--accent)]">{model.pricing}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Model Selector (only for WebLLM) */}
        {backendMode === 'webllm' && (
        <div className="mb-6 relative">
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            disabled={isLoading}
            className="w-full p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl
                       flex items-center justify-between
                       hover:border-[var(--accent)] transition-colors
                       disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-[var(--accent)]" />
              <div className="text-left">
                <p className="font-medium">{currentModelConfig?.name || '選擇模型'}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {currentModelConfig?.description || '點擊選擇 AI 模型'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-tertiary)]">
                {backendMode === 'webllm' && currentModelConfig && 'size' in currentModelConfig ? currentModelConfig.size : ''}
              </span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
            </div>
          </button>
          
          {/* Model Dropdown */}
          {showModelSelector && (
            <div className="absolute top-full left-0 right-0 mt-2 
                           bg-[var(--card)] border border-[var(--border)] rounded-xl
                           shadow-xl z-50 animate-fade-in">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] uppercase">
                  選擇 AI 模型
                </p>
                
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelChange(model.id)}
                    className={`w-full p-3 rounded-lg text-left transition-colors
                               ${currentModel === model.id 
                                 ? 'bg-[var(--accent)]/10 border border-[var(--accent)]' 
                                 : 'hover:bg-[var(--bg-secondary)]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{model.description}</p>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">{model.size}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Model Status */}
        <div className={`mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm w-full justify-center ${
          isLoading ? 'bg-yellow-500/10 text-yellow-600' :
          error ? 'bg-red-500/10 text-red-600' :
          isGenerating ? 'bg-blue-500/10 text-blue-600' :
          isReady ? 'bg-green-500/10 text-green-600' :
          'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
        }`}>
          {isLoading ? (
            <>
              <Download className="w-4 h-4 animate-bounce" />
              正在下載 {loadingModelName || currentModelConfig?.name}...
            </>
          ) : error ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {error}
            </>
          ) : isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {currentModelConfig?.name} 生成中...
            </>
          ) : isReady ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {backendMode === 'openrouter' ? (
                <><Cloud className="w-3.5 h-3.5" /> {currentModelConfig?.name || 'OpenRouter'} 已就緒</>
              ) : (
                <>{currentModelConfig?.name} 已就緒</>
              )}
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {backendMode === 'openrouter' ? '請輸入 API Key...' : '初始化中...'}
            </>
          )}
        </div>

        {/* Loading Progress (WebLLM only) */}
        {backendMode === 'webllm' && isLoading && progress && (
          <div className="mb-8 p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <Download className="w-6 h-6 animate-bounce text-[var(--accent)]" />
              <span className="font-medium">正在載入 {loadingModelName || currentModelConfig?.name}...</span>
            </div>
            
            <div className="w-full h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
                style={{ width: `${progress.progress * 100}%` }}
              />
            </div>
            
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {progress.text}
            </p>
            
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              首次載入約需 1-5 分鐘，之後即可離線使用
            </p>
          </div>
        )}

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(['ja', 'en', 'zh'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setSelectedLang(lang);
                setResult(null);
              }}
              disabled={isLoading || !!error}
              className={`px-5 py-2.5 rounded-full font-medium transition-all duration-200 ${
                selectedLang === lang
                  ? 'bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg'
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="mr-2">{langConfigs[lang].icon}</span>
              {langConfigs[lang].name}
            </button>
          ))}
        </div>

        {/* Context Selector */}
        <div className="mb-6 relative">
          <button
            onClick={() => setShowContextSelector(!showContextSelector)}
            className="w-full p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl
                       flex items-center justify-between
                       hover:border-[var(--accent)] transition-colors text-sm"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-medium">語境設定</span>
              <span className="text-[var(--text-tertiary)]">
                · 已選 {selectedContexts.length} 種
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showContextSelector ? 'rotate-180' : ''}`} />
          </button>

          {showContextSelector && (
            <div className="absolute top-full left-0 right-0 mt-2
                           bg-[var(--card)] border border-[var(--border)] rounded-xl
                           shadow-xl z-40 animate-fade-in p-3">
              <p className="px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">
                選擇要生成的語境類別（至少 1 種）
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allContexts.map((ctx) => {
                  const isSelected = selectedContexts.includes(ctx.id);
                  return (
                    <button
                      key={ctx.id}
                      onClick={() => toggleContext(ctx.id)}
                      className={`p-2.5 rounded-lg text-left transition-all text-sm flex items-center gap-2
                                 ${isSelected
                                   ? 'bg-[var(--accent)]/10 border border-[var(--accent)] text-[var(--accent)]'
                                   : 'bg-[var(--bg-secondary)] border border-transparent hover:bg-[var(--bg-tertiary)]'}`}
                    >
                      <span>{ctx.icon}</span>
                      <span className="flex-1">{ctx.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => setSelectedContexts(allContexts.map(c => c.id))}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  全選
                </button>
                <button
                  onClick={() => setSelectedContexts(allContexts.slice(0, 3).map(c => c.id))}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  精簡 (3)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search Box */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/20 to-gray-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isReady || isLoading}
            placeholder={isReady ? langConfigs[selectedLang].placeholder : '等待模型載入...'}
            className="relative w-full px-6 py-4 pr-14 text-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl 
                       placeholder-[var(--text-tertiary)] 
                       focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20
                       transition-all duration-200 disabled:opacity-50"
          />
          
          <button
            onClick={handleSearch}
            disabled={isLoading || isGenerating || !input.trim() || !isReady}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 
                       bg-[var(--accent)] text-[var(--bg-primary)] rounded-xl
                       hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {isLoading || isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Generating Status */}
        {isGenerating && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl animate-fade-in">
            <div className="relative">
              <Sparkles className="w-5 h-5 text-[var(--accent)] animate-pulse" />
            </div>
            <span className="text-sm font-medium">
              {currentModelConfig?.name} 正在生成例句... ({result?.sentences.length || 0}/{selectedContexts.length})
            </span>
            <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)] ml-auto" />
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div className="mb-8 bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden animate-slide-up shadow-lg">
            {/* Word Header */}
            <div className="p-6 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl md:text-4xl font-bold">{result.word}</h2>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                    {langConfigs[selectedLang].name}
                  </span>
                </div>
                
                <p className="text-[var(--text-secondary)]">{result.meaning}</p>
              </div>
            </div>

            {/* Sentences */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold">
                  <BookOpen className="w-5 h-5" />
                  AI 生成例句 ({result.sentences.length}{isGenerating ? `/${selectedContexts.length}` : ''})
                </h3>
                
                {!isGenerating && result.sentences.length > 0 && (
                  <button
                    onClick={handleRegenerateAll}
                    disabled={!!regeneratingIdx}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                               bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] 
                               text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                               transition-all duration-200 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    全部重新生成
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                {result.sentences.map((sentence, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[var(--bg-secondary)] rounded-xl hover:bg-[var(--bg-tertiary)] 
                               transition-all duration-200 group animate-fade-in"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
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
                      
                      <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleRegenerateSingle(idx)}
                        disabled={regeneratingIdx !== null || isGenerating}
                        className={`p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)]
                                   transition-all duration-200 disabled:opacity-50
                                   ${regeneratingIdx === idx ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title="重新生成此例句"
                      >
                        <RefreshCw className={`w-4 h-4 ${regeneratingIdx === idx ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => playAudio(sentence.original, selectedLang)}
                        className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)]
                                   transition-all duration-200"
                        title="朗讀例句"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Skeleton placeholders for sentences being generated */}
                {isGenerating && Array.from({ length: selectedContexts.length - result.sentences.length }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="p-4 bg-[var(--bg-secondary)] rounded-xl animate-pulse"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-5 w-16 bg-[var(--bg-tertiary)] rounded-full" />
                    </div>
                    <div className="h-5 w-4/5 bg-[var(--bg-tertiary)] rounded mb-2" />
                    <div className="h-4 w-3/5 bg-[var(--bg-tertiary)] rounded" />
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
              <h3 className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold">
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
            Powered by {backendMode === 'webllm' ? 'WebLLM' : 'OpenRouter API'}
          </p>
          <p className="mt-2">支援：日文 🇯🇵 | 英文 🇬🇧 | 中文 🇹🇼</p>
        </footer>
      </div>
    </div>
  );
}
