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
];

// 語言配置
export const langConfigs: Record<string, { placeholder: string; icon: string; voice: string; name: string; systemPrompt: string }> = {
  ja: { 
    placeholder: '輸入日文...', 
    icon: '🇯🇵', 
    voice: 'ja-JP', 
    name: '日本語',
    systemPrompt: '你是日語教學助手。請用用戶提供的單字生成自然的日文例句。只輸出例句本身，不需要解釋。'
  },
  en: { 
    placeholder: 'Type English...', 
    icon: '🇬🇧', 
    voice: 'en-US', 
    name: 'English',
    systemPrompt: 'You are an English teaching assistant. Generate natural English sentences using the provided word. Output only the sentence, no explanation.'
  },
  zh: { 
    placeholder: '輸入中文...', 
    icon: '🇹🇼', 
    voice: 'zh-TW', 
    name: '中文',
    systemPrompt: '你是中文教學助手。請用用戶提供的單字生成自然的中文例句。只輸出例句本身，不需要解釋。'
  },
};

// 語境配置
const contexts = [
  { name: '日常對話', desc: 'daily conversation', prompt: '日常對話的例句' },
  { name: '工作場景', desc: 'work situation', prompt: '工作場景的例句' },
  { name: '情感表達', desc: 'emotional expression', prompt: '情感表達的例句' },
  { name: '描述事物', desc: 'describing something', prompt: '描述事物的例句' },
  { name: '請求幫助', desc: 'asking for help', prompt: '請求幫助的例句' },
];

// WebLLM Hook
export function useWebLLM() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('llama-3.2-1b');
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
      
      // 如果已有模型，先卸載
      if (chatRef.current) {
        try {
          await chatRef.current.unload();
        } catch (e) {
          console.warn('Error unloading engine:', e);
        }
        chatRef.current = null;
      }
      
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
    }
  }, [isClient]);

  // 初始載入默認模型
  useEffect(() => {
    loadModel('llama-3.2-1b');
  }, [loadModel]);

  const generateSentences = useCallback(async (
    word: string,
    lang: string
  ): Promise<Sentence[]> => {
    if (!chatRef.current || !isReady) return [];

    const sentences: Sentence[] = [];
    const config = langConfigs[lang];

    for (const { name, prompt } of contexts) {
      try {
        const response = await chatRef.current.chat.completions.create({
          messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: `單字："${word}"\n語境：${prompt}\n\n請生成一個自然的例句：` }
          ],
          temperature: 0.7,
          max_tokens: 100,
        });
        
        const generated = (response.choices?.[0]?.message?.content || '').trim();
        
        if (generated && generated.length > 5 && generated.length < 200) {
          const translation = await translate(generated, lang);
          sentences.push({
            original: generated,
            translation,
            context: name,
          });
        }
      } catch (e) {
        console.error('Generation failed:', e);
      }
    }

    return sentences.slice(0, 5);
  }, [isReady]);

  return { 
    isReady, 
    isLoading, 
    progress, 
    error, 
    currentModel,
    availableModels,
    loadModel,
    generateSentences 
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
