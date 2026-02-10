'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as webllm from '@mlc-ai/web-llm';

// 類型定義
export interface Sentence {
  original: string;
  translation: string;
  context: string;
}

export interface WordResult {
  word: string;
  meaning: string;
  sentences: Sentence[];
}

export interface LoadingProgress {
  text: string;
  progress: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  size: string;
  modelId: string;
}

// 支援的模型列表
// model_id 必須精確匹配 webllm.prebuiltAppConfig.model_list 中的 model_id
export const availableModels: ModelConfig[] = [
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B',
    description: 'Meta 最新，速度最快',
    size: '~400MB',
    modelId: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    description: 'Meta 最新，質量更好',
    size: '~1.2GB',
    modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
  },
  {
    id: 'qwen-2.5-1.5b',
    name: 'Qwen 2.5 1.5B',
    description: '阿里巴巴，中文極強',
    size: '~800MB',
    modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
  },
  {
    id: 'smollm-1.7b',
    name: 'SmolLM 1.7B',
    description: 'Hugging Face，最新小模型',
    size: '~750MB',
    modelId: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
  },
  {
    id: 'phi-3.5',
    name: 'Phi 3.5 Mini',
    description: 'Microsoft，推理能力強',
    size: '~900MB',
    modelId: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  },
  // 2025-2026 最新模型
  {
    id: 'qwen3-0.6b',
    name: 'Qwen3 0.6B',
    description: '阿里最新超輕量，中文極強',
    size: '~900MB',
    modelId: 'Qwen3-0.6B-q4f16_1-MLC',
  },
  {
    id: 'qwen3-1.7b',
    name: 'Qwen3 1.7B',
    description: 'Qwen3 系列，性能更強',
    size: '~1.3GB',
    modelId: 'Qwen3-1.7B-q4f16_1-MLC',
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen3 4B',
    description: 'Qwen3 中型版本，平衡之選',
    size: '~2.2GB',
    modelId: 'Qwen3-4B-q4f16_1-MLC',
  },
  {
    id: 'ministral-3-3b-instruct',
    name: 'Ministral-3 3B Instruct',
    description: 'Mistral 2026 最新 3B 系列',
    size: '~2.0GB',
    modelId: 'Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC',
  },
  {
    id: 'ministral-3-3b-reasoning',
    name: 'Ministral-3 3B Reasoning',
    description: 'Mistral 推理專用版本（2026新）',
    size: '~2.0GB',
    modelId: 'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC',
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma-2 2B',
    description: 'Google 最新 Gemma 2 系列',
    size: '~1.3GB',
    modelId: 'gemma-2-2b-it-q4f16_1-MLC',
  },
  {
    id: 'qwen2.5-coder-1.5b',
    name: 'Qwen2.5-Coder 1.5B',
    description: '專業程式碼生成模型',
    size: '~1.0GB',
    modelId: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
  },
];

// 語言配置
export const langConfigs: Record<string, { placeholder: string; icon: string; voice: string; name: string; systemPrompt: string }> = {
  ja: { 
    placeholder: '輸入日文...', 
    icon: '🇯🇵', 
    voice: 'ja-JP', 
    name: '日本語',
    systemPrompt: '你是日語教學助手。用戶會提供一個單字，你必須用這個單字造一個完整的日文句子（至少8個字），並附上中文翻譯。\n嚴格按此格式輸出：完整日文句子|中文翻譯\n注意：必須是完整句子，不能只輸出單字或詞語。不要輸出任何解釋。\n範例：今日は天気がいいです|今天天氣很好'
  },
  en: { 
    placeholder: 'Type English...', 
    icon: '🇬🇧', 
    voice: 'en-US', 
    name: 'English',
    systemPrompt: 'You are an English teaching assistant. The user provides a word. You MUST generate a complete English sentence (at least 5 words) using it, with Chinese translation.\nStrictly follow this format: Complete English sentence|中文翻譯\nIMPORTANT: Output a FULL sentence, NOT just the word. No explanation.\nExample: The weather is beautiful today|今天天氣很美'
  },
  zh: { 
    placeholder: '輸入中文...', 
    icon: '🇹🇼', 
    voice: 'zh-TW', 
    name: '中文',
    systemPrompt: '你是中文教學助手。用戶會提供一個單字，你必須用這個單字造一個完整的中文句子（至少8個字），並附上英文翻譯。\n嚴格按此格式輸出：完整中文句子|English translation\n注意：必須是完整句子，不能只輸出單字或詞語。不要輸出任何解釋。\n範例：我每天都會去公園散步|I go for a walk in the park every day'
  },
};

// 語境配置（導出供 UI 使用）
export interface ContextConfig {
  id: string;
  name: string;
  desc: string;
  prompt: string;
  icon: string;
}

export const allContexts: ContextConfig[] = [
  { id: 'daily', name: '日常對話', desc: 'daily conversation', prompt: '日常對話的例句', icon: '💬' },
  { id: 'work', name: '工作場景', desc: 'work situation', prompt: '工作場景的例句', icon: '💼' },
  { id: 'emotion', name: '情感表達', desc: 'emotional expression', prompt: '情感表達的例句', icon: '❤️' },
  { id: 'describe', name: '描述事物', desc: 'describing something', prompt: '描述事物的例句', icon: '🔍' },
  { id: 'help', name: '請求幫助', desc: 'asking for help', prompt: '請求幫助的例句', icon: '🙏' },
  { id: 'travel', name: '旅行出遊', desc: 'travel and tourism', prompt: '旅行出遊的例句', icon: '✈️' },
  { id: 'food', name: '美食料理', desc: 'food and cooking', prompt: '美食料理的例句', icon: '🍜' },
  { id: 'literature', name: '文學書面', desc: 'literary expression', prompt: '文學書面語的例句', icon: '📚' },
  { id: 'casual', name: '口語俚語', desc: 'slang and casual', prompt: '口語或俚語的例句', icon: '😎' },
  { id: 'academic', name: '學術正式', desc: 'academic and formal', prompt: '學術或正式場合的例句', icon: '🎓' },
];

// 清除 AI 輸出中的 thinking 標籤（Qwen3 等推理模型會輸出 <think>...</think>）
function stripThinkingTags(text: string): string {
  // 移除 <think>...</think> 區塊（包含換行）
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 移除未閉合的 <think>... 區塊
  cleaned = cleaned.replace(/<think>[\s\S]*/gi, '');
  // 移除殘留的 </think>
  cleaned = cleaned.replace(/<\/think>/gi, '');
  cleaned = cleaned.trim();
  
  // 如果清理後有多行，嘗試找到包含 | 的那行
  if (cleaned.includes('\n')) {
    const lines = cleaned.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const pipeLine = lines.find((l: string) => l.includes('|'));
    if (pipeLine) return pipeLine;
    // 沒有 | 就取最後一行（通常是答案）
    return lines[lines.length - 1] || cleaned;
  }
  
  return cleaned;
}

// 生成單條例句的核心邏輯（支持重試）
async function generateOneSentence(
  engine: any,
  config: { systemPrompt: string },
  word: string,
  contextName: string,
  contextPrompt: string,
  lang: string,
  attempt = 1
): Promise<Sentence | null> {
  const MAX_ATTEMPTS = 2;
  const sentenceStartTime = performance.now();
  
  const response = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: `單字：「${word}」\n語境：${contextPrompt}\n\n請用「${word}」造一個完整的句子，格式：句子|翻譯` }
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  const rawGenerated = (response.choices?.[0]?.message?.content || '').trim();
  const generated = stripThinkingTags(rawGenerated);

  const sentenceTime = ((performance.now() - sentenceStartTime) / 1000).toFixed(1);
  console.log(`[WebLLM]   📝 [${contextName}] ${sentenceTime}s (attempt ${attempt}) - 原始: "${rawGenerated.substring(0, 100)}"`);
  if (rawGenerated !== generated) {
    console.log(`[WebLLM]   🧹 已清除 thinking 標籤, 清理後: "${generated.substring(0, 100)}"`);
  }

  let sentence: Sentence | null = null;

  // 解析 "原文|翻譯" 格式
  if (generated && generated.includes('|')) {
    const parts = generated.split('|');
    const original = parts[0].trim();
    const translation = parts.slice(1).join('|').trim();
    // 驗證是完整句子（不只是單字重複）
    if (original && translation && original.length > 4 && original.length < 300 
        && original !== word && original.length > word.length + 2) {
      sentence = { original, translation, context: contextName };
    }
  }

  // 備用方案：沒有 | 但有足夠長度的內容
  if (!sentence && generated && generated.length > 6 && generated.length < 300 
      && generated !== word && generated.length > word.length + 2) {
    console.log(`[WebLLM]   ⚠️ 未按格式輸出，使用翻譯 API`);
    const translation = await translate(generated, lang);
    sentence = { original: generated, translation, context: contextName };
  }

  // 如果結果不完整（太短或只是單字），重試一次
  if (!sentence && attempt < MAX_ATTEMPTS) {
    console.log(`[WebLLM]   🔄 輸出不完整，重試第 ${attempt + 1} 次...`);
    return generateOneSentence(engine, config, word, contextName, contextPrompt, lang, attempt + 1);
  }

  return sentence;
}

// WebLLM Hook
export function useWebLLM() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('llama-3.2-1b');
  const [loadingModelName, setLoadingModelName] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const isClient = typeof window !== 'undefined';

  // 初始化或切換模型
  const loadModel = useCallback(async (modelId: string) => {
    if (!isClient) return;
    
    const modelConfig = availableModels.find(m => m.id === modelId);
    if (!modelConfig) return;

    try {
      setIsLoading(true);
      setError(null);
      setLoadingModelName(modelConfig.name);
      
      // 如果已有模型，先卸載
      if (chatRef.current) {
        try {
          await chatRef.current.unload();
        } catch (e) {
          console.warn('Error unloading engine:', e);
        }
        chatRef.current = null;
      }
      
      const loadStartTime = performance.now();
      console.log(`[WebLLM] 開始載入模型: ${modelConfig.name} (${modelConfig.modelId})`);
      
      // 使用 CreateMLCEngine API
      const engine = await webllm.CreateMLCEngine(modelConfig.modelId, {
        initProgressCallback: (report: any) => {
          if (report) {
            setProgress({
              text: report.text || '載入中...',
              progress: typeof report.progress === 'number' ? report.progress : 0,
            });
          }
        },
      });
      
      const loadTime = ((performance.now() - loadStartTime) / 1000).toFixed(1);
      console.log(`[WebLLM] ✅ 模型載入完成: ${modelConfig.name}，耗時 ${loadTime}s`);
      
      chatRef.current = engine;
      setCurrentModel(modelId);
      setIsReady(true);
      setError(null);
    } catch (err: any) {
      console.error('WebLLM init failed:', err);
      // 如果是模型不存在錯誤，嘗試使用第一個可用的模型
      if (err.message && err.message.includes('Cannot find model')) {
        setError('模型載入失敗，將使用 Llama 3.2 1B');
        // 遞迴調用，改用備選模型
        if (modelId !== 'llama-3.2-1b') {
          setTimeout(() => loadModel('llama-3.2-1b'), 1000);
        } else {
          setError('模型載入失敗：沒有可用的備選模型');
          setIsReady(false);
        }
      } else {
        setError(err.message || '模型載入失敗');
        setIsReady(false);
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
      setLoadingModelName(null);
    }
  }, [isClient]);

  // 初始載入默認模型
  useEffect(() => {
    loadModel('llama-3.2-1b');
  }, [loadModel]);

  const generateSentences = useCallback(async (
    word: string,
    lang: string,
    selectedContextIds?: string[],
    onSentence?: (sentence: Sentence) => void
  ): Promise<Sentence[]> => {
    if (!chatRef.current || !isReady) return [];

    setIsGenerating(true);
    const totalStartTime = performance.now();
    console.log(`[WebLLM] 🔄 開始生成例句: "${word}" (${lang})`);
    
    const sentences: Sentence[] = [];
    const config = langConfigs[lang];
    
    // 根據用戶選擇過濾語境
    const selectedContexts = selectedContextIds && selectedContextIds.length > 0
      ? allContexts.filter(c => selectedContextIds.includes(c.id))
      : allContexts.slice(0, 5); // 默認前5個

    for (const { name, prompt } of selectedContexts) {
      try {
        const sentence = await generateOneSentence(chatRef.current, config, word, name, prompt, lang);
        if (sentence) {
          sentences.push(sentence);
          if (onSentence) {
            onSentence(sentence);
          }
        }
      } catch (e) {
        console.error('[WebLLM]   ❌ Generation failed:', e);
      }
    }

    const totalTime = ((performance.now() - totalStartTime) / 1000).toFixed(1);
    console.log(`[WebLLM] ✅ 生成完成: ${sentences.length} 個例句，總耗時 ${totalTime}s`);
    setIsGenerating(false);
    return sentences;
  }, [isReady]);

  // 重新生成單條例句
  const regenerateSingle = useCallback(async (
    word: string,
    lang: string,
    contextId: string
  ): Promise<Sentence | null> => {
    if (!chatRef.current || !isReady) return null;
    
    const ctx = allContexts.find(c => c.id === contextId);
    if (!ctx) return null;
    
    const config = langConfigs[lang];
    console.log(`[WebLLM] 🔄 重新生成: "${word}" [${ctx.name}]`);
    
    try {
      const sentence = await generateOneSentence(chatRef.current, config, word, ctx.name, ctx.prompt, lang);
      return sentence;
    } catch (e) {
      console.error('[WebLLM] ❌ Regenerate failed:', e);
      return null;
    }
  }, [isReady]);

  return { 
    isReady, 
    isLoading, 
    isGenerating,
    progress, 
    error, 
    currentModel,
    loadingModelName,
    availableModels,
    loadModel,
    generateSentences,
    regenerateSingle 
  };
}

// 翻譯
async function translate(text: string, fromLang: string): Promise<string> {
  try {
    const from = fromLang === 'ja' ? 'ja' : fromLang === 'zh' ? 'zh' : 'en';
    const to = fromLang === 'en' ? 'zh' : 'en';
    
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
    );
    const data = await response.json();
    return data.responseData?.translatedText || '(翻譯失敗)';
  } catch {
    return '(翻譯失敗)';
  }
}

// 播放音頻
export function playAudio(text: string, lang: string) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langConfigs[lang]?.voice || 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// 歷史記錄
export function useHistory() {
  const [history, setHistory] = useState<Array<{ word: string; lang: string }>>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('lang-learn-history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const addToHistory = useCallback((word: string, lang: string) => {
    if (!isClient) return;
    setHistory((prev) => {
      const filtered = prev.filter((h) => !(h.word === word && h.lang === lang));
      const newHistory = [{ word, lang }, ...filtered].slice(0, 20);
      localStorage.setItem('lang-learn-history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, [isClient]);

  const clearHistory = useCallback(() => {
    if (!isClient) return;
    setHistory([]);
    localStorage.removeItem('lang-learn-history');
  }, [isClient]);

  return { history, addToHistory, clearHistory, isClient };
}

// 主題切換
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('lang-learn-theme') as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'light';
      setTheme(initialTheme);
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('lang-learn-theme', newTheme);
  }, [theme]);

  return { theme, toggleTheme, mounted };
}
