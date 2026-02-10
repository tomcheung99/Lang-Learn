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
export const langConfigs: Record<string, { placeholder: string; icon: string; voice: string; name: string }> = {
  ja: { placeholder: '輸入日文...', icon: '🇯🇵', voice: 'ja-JP', name: '日本語' },
  en: { placeholder: 'Type English...', icon: '🇬🇧', voice: 'en-US', name: 'English' },
  zh: { placeholder: '輸入中文...', icon: '🇹🇼', voice: 'zh-TW', name: '中文' },
};

// 語境配置
const contexts = [
  { name: '日常對話', desc: 'daily conversation', emoji: '💬' },
  { name: '工作場景', desc: 'work situation', emoji: '💼' },
  { name: '情感表達', desc: 'emotional expression', emoji: '❤️' },
  { name: '描述事物', desc: 'describing something', emoji: '📝' },
  { name: '請求幫助', desc: 'asking for help', emoji: '🙏' },
];

// 檢測詞性 - 基於詞彙特徵
function detectWordType(word: string, lang: string): 'noun' | 'verb' | 'adjective' | 'greeting' | 'unknown' {
  // 日文動詞結尾
  if (lang === 'ja') {
    if (word.endsWith('る') || word.endsWith('う') || word.endsWith('く') || 
        word.endsWith('す') || word.endsWith('つ') || word.endsWith('む') ||
        word.endsWith('ぶ') || word.endsWith('ぐ') || word.endsWith('ぬ') ||
        word.endsWith('い')) {
      return 'verb';
    }
    // 日文形容詞
    if (word.endsWith('い') || word.endsWith('な')) {
      return 'adjective';
    }
  }
  
  // 中文動詞特徵
  if (lang === 'zh') {
    const verbIndicators = ['吃', '喝', '走', '跑', '看', '聽', '說', '做', '學', '去', '來', '睡'];
    if (verbIndicators.some(v => word.includes(v))) return 'verb';
  }
  
  // 英文動詞特徵
  if (lang === 'en') {
    if (word.endsWith('ing') || word.endsWith('ed') || word.endsWith('s')) {
      return 'verb';
    }
  }
  
  // 招呼語
  const greetings = ['晚安', '早安', '你好', 'hello', 'hi', 'good morning', 'good night', 'こんにちは', 'おはよう'];
  if (greetings.some(g => word.toLowerCase().includes(g))) {
    return 'greeting';
  }
  
  return 'noun';
}

// 獲取適合的模板
function getTemplates(word: string, wordType: string, lang: string): Array<{ template: string; translation: string; context: string }> {
  const templates: Record<string, Record<string, Array<{ template: string; translation: string; context: string }>>> = {
    ja: {
      noun: [
        { template: `昨日、${word}について考えていた。`, translation: `昨天我一直在思考關於${word}的事。`, context: '日常對話' },
        { template: `友達と${word}の話をした。`, translation: `我和朋友聊了關於${word}的話題。`, context: '日常對話' },
        { template: `${word}は私の人生に大きな影響を与えた。`, translation: `${word}對我的人生產生了重大影響。`, context: '情感表達' },
        { template: `毎日、${word}に触れることが大切だ。`, translation: `每天接觸${word}是很重要的。`, context: '描述事物' },
        { template: `${word}を通じて新しい世界が開けた。`, translation: `透過${word}開啟了新的世界。`, context: '情感表達' },
      ],
      verb: [
        { template: `毎朝、私は${word}のが好きだ。`, translation: `我喜歡每天早上${word}。`, context: '日常對話' },
        { template: `仕事の後で${word}と思う。`, translation: `工作後我想${word}。`, context: '工作場景' },
        { template: `一緒に${word}ませんか？`, translation: `要不要一起${word}？`, context: '請求幫助' },
        { template: `${word}ことは人生の楽しみだ。`, translation: `${word}是人生的樂趣之一。`, context: '情感表達' },
        { template: `週末はよく${word}。`, translation: `週末經常${word}。`, context: '日常對話' },
      ],
      adjective: [
        { template: `この${word}景色が好きだ。`, translation: `我喜歡這個${word}的景色。`, context: '描述事物' },
        { template: `彼はとても${word}人だ。`, translation: `他是一個非常${word}的人。`, context: '描述事物' },
        { template: `${word}気分になった。`, translation: `變得${word}起來了。`, context: '情感表達' },
        { template: `今日は${word}一日だった。`, translation: `今天是${word}的一天。`, context: '日常對話' },
        { template: `${word}ものを探している。`, translation: `我正在尋找${word}的東西。`, context: '請求幫助' },
      ],
      greeting: [
        { template: `寝る前に${word}と言う。`, translation: `睡前說${word}。`, context: '日常對話' },
        { template: `家族に${word}と送った。`, translation: `給家人發了${word}。`, context: '情感表達' },
        { template: `電話で${word}と言った。`, translation: `在電話裡說了${word}。`, context: '日常對話' },
        { template: `いつも${word}を忘れない。`, translation: `永遠不忘記說${word}。`, context: '情感表達' },
        { template: `大事な人に${word}を伝えた。`, translation: `向重要的人傳達了${word}。`, context: '情感表達' },
      ],
    },
    en: {
      noun: [
        { template: `Yesterday, I kept thinking about ${word}.`, translation: `昨天我一直在思考關於${word}的事。`, context: '日常對話' },
        { template: `I had a conversation with my friend about ${word}.`, translation: `我和朋友聊了關於${word}的話題。`, context: '日常對話' },
        { template: `${word} has had a profound impact on my life.`, translation: `${word}對我的人生產生了深遠的影響。`, context: '情感表達' },
        { template: `It's important to engage with ${word} every day.`, translation: `每天接觸${word}是很重要的。`, context: '描述事物' },
        { template: `Through ${word}, I discovered a new world.`, translation: `透過${word}我發現了新的世界。`, context: '情感表達' },
      ],
      verb: [
        { template: `I enjoy ${word} every morning.`, translation: `我喜歡每天早上${word}。`, context: '日常對話' },
        { template: `After work, I want to ${word}.`, translation: `工作後我想${word}。`, context: '工作場景' },
        { template: `Would you like to ${word} with me?`, translation: `要不要和我一起${word}？`, context: '請求幫助' },
        { template: `${word} is one of the joys of life.`, translation: `${word}是人生的樂趣之一。`, context: '情感表達' },
        { template: `I often ${word} on weekends.`, translation: `我週末經常${word}。`, context: '日常對話' },
      ],
      adjective: [
        { template: `I love this ${word} scenery.`, translation: `我喜歡這個${word}的景色。`, context: '描述事物' },
        { template: `He is a very ${word} person.`, translation: `他是一個非常${word}的人。`, context: '描述事物' },
        { template: `I feel ${word} today.`, translation: `我今天感覺${word}。`, context: '情感表達' },
        { template: `It was a ${word} day.`, translation: `這是${word}的一天。`, context: '日常對話' },
        { template: `I'm looking for something ${word}.`, translation: `我正在尋找${word}的東西。`, context: '請求幫助' },
      ],
      greeting: [
        { template: `I say ${word} before going to bed.`, translation: `睡前我說${word}。`, context: '日常對話' },
        { template: `I sent ${word} to my family.`, translation: `我給家人發了${word}。`, context: '情感表達' },
        { template: `I said ${word} on the phone.`, translation: `我在電話裡說了${word}。`, context: '日常對話' },
        { template: `I never forget to say ${word}.`, translation: `我永遠不忘記說${word}。`, context: '情感表達' },
        { template: `I expressed ${word} to someone important.`, translation: `我向重要的人表達了${word}。`, context: '情感表達' },
      ],
    },
    zh: {
      noun: [
        { template: `昨天我一直在思考關於${word}的事。`, translation: `Yesterday, I kept thinking about ${word}.`, context: '日常對話' },
        { template: `我和朋友聊了關於${word}的話題。`, translation: `I had a conversation with my friend about ${word}.`, context: '日常對話' },
        { template: `${word}對我的人生產生了重大影響。`, translation: `${word} has had a significant impact on my life.`, context: '情感表達' },
        { template: `每天接觸${word}是很重要的。`, translation: `It's important to engage with ${word} every day.`, context: '描述事物' },
        { template: `透過${word}我發現了新的世界。`, translation: `Through ${word}, I discovered a new world.`, context: '情感表達' },
      ],
      verb: [
        { template: `我喜歡每天早上${word}。`, translation: `I enjoy ${word} every morning.`, context: '日常對話' },
        { template: `工作後我想${word}。`, translation: `After work, I want to ${word}.`, context: '工作場景' },
        { template: `要不要和我一起${word}？`, translation: `Would you like to ${word} with me?`, context: '請求幫助' },
        { template: `${word}是人生的樂趣之一。`, translation: `${word} is one of the joys of life.`, context: '情感表達' },
        { template: `我週末經常${word}。`, translation: `I often ${word} on weekends.`, context: '日常對話' },
      ],
      adjective: [
        { template: `我喜歡這個${word}的景色。`, translation: `I love this ${word} scenery.`, context: '描述事物' },
        { template: `他是一個非常${word}的人。`, translation: `He is a very ${word} person.`, context: '描述事物' },
        { template: `我今天感覺${word}。`, translation: `I feel ${word} today.`, context: '情感表達' },
        { template: `這是${word}的一天。`, translation: `It was a ${word} day.`, context: '日常對話' },
        { template: `我正在尋找${word}的東西。`, translation: `I'm looking for something ${word}.`, context: '請求幫助' },
      ],
      greeting: [
        { template: `睡前我會說${word}。`, translation: `I say ${word} before going to bed.`, context: '日常對話' },
        { template: `我給家人發了${word}。`, translation: `I sent ${word} to my family.`, context: '情感表達' },
        { template: `我在電話裡說了${word}。`, translation: `I said ${word} on the phone.`, context: '日常對話' },
        { template: `我永遠不忘記說${word}。`, translation: `I never forget to say ${word}.`, context: '情感表達' },
        { template: `我向重要的人表達了${word}。`, translation: `I expressed ${word} to someone important.`, context: '情感表達' },
      ],
    },
  };

  return templates[lang]?.[wordType] || templates[lang]?.['noun'] || [];
}

// 智能例句生成
export function generateSmartSentences(word: string, lang: string): Array<{ original: string; translation: string; context: string }> {
  const wordType = detectWordType(word, lang);
  const templates = getTemplates(word, wordType, lang);
  
  // 隨機選擇最多 5 個不同的模板
  const shuffled = [...templates].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5);
}

// Web LLM Hook
export function useWebLLM() {
  const [isReady, setIsReady] = useState(true); // 現在始終就緒，使用模板生成
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSentences = useCallback(async (
    word: string,
    lang: string
  ): Promise<Sentence[]> => {
    setIsLoading(true);
    
    // 模擬延遲以顯示加載狀態
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const sentences = generateSmartSentences(word, lang);
    
    setIsLoading(false);
    return sentences;
  }, []);

  return { isReady: true, isLoading, error, generateSentences };
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
      // 檢測系統偏好
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
