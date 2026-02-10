'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

// 語言配置
export const langConfigs: Record<string, { placeholder: string; icon: string; voice: string }> = {
  ja: { placeholder: '輸入日文...', icon: '🇯🇵', voice: 'ja-JP' },
  en: { placeholder: 'Type English...', icon: '🇬🇧', voice: 'en-US' },
  zh: { placeholder: '輸入中文...', icon: '🇹🇼', voice: 'zh-TW' },
};

// 語境配置
const contexts = [
  { name: '日常對話', desc: 'daily conversation' },
  { name: '工作場景', desc: 'work situation' },
  { name: '情感表達', desc: 'emotional expression' },
  { name: '描述事物', desc: 'describing something' },
  { name: '請求幫助', desc: 'asking for help' },
];

// Web LLM Hook
export function useWebLLM() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generatorRef = useRef<any>(null);
  const isClient = typeof window !== 'undefined';

  useEffect(() => {
    // 只在客戶端載入模型
    if (!isClient) return;
    
    const loadModel = async () => {
      try {
        setIsLoading(true);
        
        // 動態導入 Transformers.js (只在客戶端)
        const { pipeline } = await import('@huggingface/transformers');
        
        const generator = await pipeline(
          'text-generation',
          'onnx-community/TinyLlama-1.1B-Chat-v1.0',
          {
            dtype: 'q4f16',
            device: 'webgpu',
          }
        );
        
        generatorRef.current = generator;
        setIsReady(true);
        setError(null);
      } catch (err: any) {
        console.error('Model load failed:', err);
        // 如果 WebGPU 失敗，嘗試 CPU 模式
        try {
          const { pipeline } = await import('@huggingface/transformers');
          const generator = await pipeline(
            'text-generation',
            'onnx-community/TinyLlama-1.1B-Chat-v1.0',
            {
              dtype: 'q4f16',
              device: 'cpu',
            }
          );
          generatorRef.current = generator;
          setIsReady(true);
          setError(null);
        } catch (cpuErr) {
          setError('模型載入失敗，請檢查瀏覽器是否支援 WebGPU 或 WebAssembly');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [isClient]);

  const generateSentences = useCallback(async (
    word: string,
    lang: string
  ): Promise<Sentence[]> => {
    if (!generatorRef.current) return [];

    const sentences: Sentence[] = [];

    for (const { name, desc } of contexts) {
      let prompt = '';
      
      if (lang === 'ja') {
        prompt = `<|system|>\n你是日語教學助手。請用「${word}」生成一個自然的日文例句，語境是${desc}。只輸出例句本身，不要解釋。\n<|user|>\n請給我一個${desc}的例句。\n<|assistant|>\n`;
      } else if (lang === 'zh') {
        prompt = `<|system|>\n你是中文教學助手。請用「${word}」生成一個自然的中文例句，語境是${desc}。只輸出例句本身，不要解釋。\n<|user|>\n請給我一個${desc}的例句。\n<|assistant|>\n`;
      } else {
        prompt = `<|system|>\nYou are an English teaching assistant. Please generate a natural English sentence using "${word}" in the context of ${desc}. Output only the sentence, no explanation.\n<|user|>\nGive me a sentence about ${desc}.\n<|assistant|>\n`;
      }

      try {
        const output = await generatorRef.current(prompt, {
          max_new_tokens: 50,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false,
        });

        const generated = output[0]?.generated_text?.trim() || '';
        const clean = cleanOutput(generated, word);
        
        if (clean && clean.length > 5) {
          const translation = await translate(clean, lang);
          sentences.push({
            original: clean,
            translation,
            context: name,
          });
        }
      } catch (e) {
        console.error('Generation failed:', e);
      }
    }

    return sentences.slice(0, 5);
  }, []);

  return { isReady, isLoading, error, generateSentences };
}

// 清理輸出
function cleanOutput(text: string, word: string): string {
  let cleaned = text
    .replace(/<\|.*\|>/g, '')
    .replace(/^(例句：|Sentence:|Example:|\d+\.\s*)/i, '')
    .replace(/[\n\r]/g, ' ')
    .trim();

  if (!cleaned.includes(word)) return '';
  if (cleaned.length > 100) cleaned = cleaned.substring(0, 100) + '...';

  return cleaned;
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
  const isClient = typeof window !== 'undefined';

  useEffect(() => {
    if (!isClient) return;
    const saved = localStorage.getItem('lang-learn-history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, [isClient]);

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

  return { history, addToHistory, clearHistory };
}
