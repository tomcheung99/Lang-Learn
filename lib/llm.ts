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
  const chatRef = useRef<webllm.ChatModule | null>(null);
  const isClient = typeof window !== 'undefined';

  // 初始化 WebLLM
  useEffect(() => {
    if (!isClient) return;
    
    const initChat = async () => {
      try {
        setIsLoading(true);
        
        const chat = new webllm.ChatModule();
        
        // 設置進度回調
        chat.setInitProgressCallback((report: webllm.InitProgressReport) => {
          setProgress({
            text: report.text,
            progress: report.progress,
          });
        });
        
        // 載入 Gemma 3 1B 模型
        // 注意：WebLLM 可能還沒有官方 Gemma 3 支援，先用 Gemma 2 或等待更新
        await chat.reload('gemma-2b-it-q4f16_1', {
          chat_opts: {
            temperature: 0.7,
            max_gen_len: 100,
          }
        });
        
        chatRef.current = chat;
        setIsReady(true);
        setError(null);
      } catch (err: any) {
        console.error('WebLLM init failed:', err);
        setError(err.message || '模型載入失敗');
      } finally {
        setIsLoading(false);
        setProgress(null);
      }
    };
    
    initChat();
    
    // 清理
    return () => {
      if (chatRef.current) {
        chatRef.current.unload();
      }
    };
  }, [isClient]);

  const generateSentences = useCallback(async (
    word: string,
    lang: string
  ): Promise<Sentence[]> => {
    if (!chatRef.current || !isReady) return [];

    const sentences: Sentence[] = [];
    const config = langConfigs[lang];

    for (const { name, prompt } of contexts) {
      try {
        const userPrompt = `${config.systemPrompt}\n\n單字："${word}"\n語境：${prompt}\n\n請生成一個自然的例句：`;
        
        const response = await chatRef.current.generate(userPrompt, (step: number, msg: string) => {
          console.log(`Generating step ${step}: ${msg}`);
        });
        
        const generated = response.trim();
        
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

  return { isReady, isLoading, progress, error, generateSentences };
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
