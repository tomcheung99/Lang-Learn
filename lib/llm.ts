'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
// 延遲載入 WebLLM — 避免在手機上 import 巨大的 WASM 模組導致記憶體爆滿
// 只有在真正需要時才 dynamic import
let webllmModule: typeof import('@mlc-ai/web-llm') | null = null;
async function getWebLLM() {
  if (!webllmModule) {
    webllmModule = await import('@mlc-ai/web-llm');
  }
  return webllmModule;
}

// ===== 裝置能力檢測 =====
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  // 檢測 UA 和螢幕尺寸
  const ua = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  const isMobileUA = mobileKeywords.some(keyword => ua.includes(keyword));
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA || isSmallScreen;
}

export function hasWebGPU(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator;
}

export function getDeviceMemoryGB(): number | null {
  if (typeof navigator === 'undefined') return null;
  // @ts-ignore - deviceMemory is experimental
  return navigator.deviceMemory || null;
}

export async function hasEnoughStorage(minBytes: number): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return true; // 無法檢測就假設夠用
  try {
    const estimate = await navigator.storage.estimate();
    const available = (estimate.quota || 0) - (estimate.usage || 0);
    return available >= minBytes;
  } catch {
    return true; // 檢測失敗就假設夠用
  }
}

export function shouldUseCloud(): boolean {
  const mobile = isMobile();
  const hasGPU = hasWebGPU();
  const memory = getDeviceMemoryGB();
  
  // 手機或沒有 WebGPU → 建議用雲端
  if (mobile || !hasGPU) return true;
  
  // 記憶體小於 4GB → 建議用雲端
  if (memory !== null && memory < 4) return true;
  
  return false;
}

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
  isThinking?: boolean; // 是否為推理/思考模型（Qwen3、Reasoning 等）
}

// 支援的模型列表
// model_id 必須精確匹配 webllm.prebuiltAppConfig.model_list 中的 model_id
export const availableModels: ModelConfig[] = [
  {
    id: 'qwen3-1.7b',
    name: 'Qwen3 1.7B',
    description: '速度快，中日英表現穩定',
    size: '~1.3GB',
    modelId: 'Qwen3-1.7B-q4f16_1-MLC',
    isThinking: true,
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen3 4B',
    description: '質量最佳，推薦使用',
    size: '~2.2GB',
    modelId: 'Qwen3-4B-q4f16_1-MLC',
    isThinking: true,
  },
];

// ===== 後端模式 =====
export type BackendMode = 'webllm' | 'openrouter';

// OpenRouter 模型配置
export interface OpenRouterModelConfig {
  id: string;
  name: string;
  description: string;
  modelId: string;
  pricing: string;
}

export const openRouterModels: OpenRouterModelConfig[] = [
  // {
  //   id: 'qwen3-4b',
  //   name: 'Qwen3 4B',
  //   description: '小巧高效，適合快速生成',
  //   modelId: 'qwen/qwen3-4b',
  //   pricing: '$0.02/M',
  // },
  {
    id: 'qwen3-8b',
    name: 'Qwen3 8B',
    description: '性能均衡，推薦使用',
    modelId: 'qwen/qwen3-8b',
    pricing: '$0.06/M',
  },
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B',
    description: '質量最佳，複雜任務首選',
    modelId: 'qwen/qwen3-32b',
    pricing: '$0.24/M',
  },
  {
    id: 'gpt-oss-20b',
    name: 'GPT OSS 20B',
    description: '開源推理模型，邏輯能力強',
    modelId: 'openai/gpt-oss-20b',
    pricing: '$0.14/M',
  }
];

// 語言配置
// systemPrompt 簡短指令，fewShot 提供大量多輪範例讓小模型穩定輸出
export interface LangConfig {
  placeholder: string;
  icon: string;
  voice: string;
  name: string;
  systemPrompt: string;
  fewShot: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const langConfigs: Record<string, LangConfig> = {
  ja: { 
    placeholder: '輸入日文...', 
    icon: '🇯🇵', 
    voice: 'ja-JP', 
    name: '日本語',
    systemPrompt: '你是日語造句助手。用戶給你一個單字和語境，你用這個單字造一個完整自然的日文句子，並附中文翻譯。只輸出一行，格式：日文句子|中文翻譯。不要輸出任何其他內容。',
    fewShot: [
      { role: 'user', content: '單字：「食べる」\n語境：日常對話的例句\n\n請用「食べる」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '毎朝パンを食べるのが私の習慣です|每天早上吃麵包是我的習慣' },
      { role: 'user', content: '單字：「勉強」\n語境：工作場景的例句\n\n請用「勉強」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '新しいプログラミング言語を勉強して、仕事に活かしたい|我想學習新的程式語言，應用在工作上' },
      { role: 'user', content: '單字：「嬉しい」\n語境：情感表達的例句\n\n請用「嬉しい」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '友達からの手紙を読んで、とても嬉しい気持ちになりました|讀了朋友的來信，心情變得非常開心' },
      { role: 'user', content: '單字：「桜」\n語境：描述事物的例句\n\n請用「桜」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '春になると公園の桜が美しく咲き誇ります|到了春天，公園的櫻花盛開得非常美麗' },
      { role: 'user', content: '單字：「行く」\n語境：旅行出遊的例句\n\n請用「行く」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '来月、家族と一緒に京都へ旅行に行く予定です|下個月，我打算和家人一起去京都旅行' },
    ]
  },
  en: { 
    placeholder: 'Type English...', 
    icon: '🇬🇧', 
    voice: 'en-US', 
    name: 'English',
    systemPrompt: 'You are a sentence-making assistant. The user gives you a word and a context. You make one complete natural English sentence using that word, with Chinese translation. Output exactly one line in this format: English sentence|中文翻譯. No other text.',
    fewShot: [
      { role: 'user', content: '單字：「happy」\n語境：日常對話的例句\n\n請用「happy」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: 'I feel so happy when I spend time with my family|和家人在一起的時候我感到非常開心' },
      { role: 'user', content: '單字：「important」\n語境：工作場景的例句\n\n請用「important」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: 'It is important to meet the deadline for this project|按時完成這個專案的截止日期非常重要' },
      { role: 'user', content: '單字：「beautiful」\n語境：描述事物的例句\n\n請用「beautiful」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: 'The sunset over the ocean was absolutely beautiful|海上的日落真是美極了' },
      { role: 'user', content: '單字：「help」\n語境：請求幫助的例句\n\n請用「help」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: 'Could you please help me carry these heavy boxes upstairs|你能幫我把這些重箱子搬到樓上嗎' },
      { role: 'user', content: '單字：「travel」\n語境：旅行出遊的例句\n\n請用「travel」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: 'I love to travel to different countries and experience new cultures|我喜歡去不同的國家旅行，體驗新的文化' },
    ]
  },
  zh: { 
    placeholder: '輸入中文...', 
    icon: '🇹🇼', 
    voice: 'zh-TW', 
    name: '中文',
    systemPrompt: '你是中文造句助手。用戶給你一個單字和語境，你用這個單字造一個完整自然的中文句子，並附英文翻譯。只輸出一行，格式：中文句子|English translation。不要輸出任何其他內容。',
    fewShot: [
      { role: 'user', content: '單字：「開心」\n語境：日常對話的例句\n\n請用「開心」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '今天和朋友一起去逛街，我覺得非常開心|I went shopping with my friends today and felt very happy' },
      { role: 'user', content: '單字：「努力」\n語境：工作場景的例句\n\n請用「努力」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '他每天都很努力地工作，希望能得到升職的機會|He works very hard every day, hoping to get a promotion' },
      { role: 'user', content: '單字：「思念」\n語境：情感表達的例句\n\n請用「思念」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '離開家鄉之後，我常常思念遠方的父母|After leaving my hometown, I often miss my parents far away' },
      { role: 'user', content: '單字：「美味」\n語境：美食料理的例句\n\n請用「美味」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '媽媽做的紅燒肉真的非常美味，讓人回味無窮|The braised pork my mom makes is really delicious and unforgettable' },
      { role: 'user', content: '單字：「學習」\n語境：學術正式的例句\n\n請用「學習」造一個完整的句子，格式：句子|翻譯' },
      { role: 'assistant', content: '持續學習新知識是提升個人競爭力的關鍵|Continuously learning new knowledge is the key to improving personal competitiveness' },
    ]
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
  isThinking = false,
  attempt = 1
): Promise<Sentence | null> {
  const MAX_ATTEMPTS = 2;
  const sentenceStartTime = performance.now();
  
  // 構建 few-shot 多輪對話 messages
  const userContent = `單字：「${word}」\n語境：${contextPrompt}\n\n請用「${word}」造一個完整的句子，格式：句子|翻譯${isThinking ? ' /no_think' : ''}`;
  
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: config.systemPrompt },
    // 插入 few-shot 範例（多輪 user/assistant 交替）
    ...((config as any).fewShot || []),
    // 真正的用戶請求
    { role: 'user', content: userContent }
  ];
  
  const response = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    // 思考模型給更多 token 作為安全網（即使 /no_think 失效也有足夠空間）
    max_tokens: isThinking ? 500 : 200,
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
    return generateOneSentence(engine, config, word, contextName, contextPrompt, lang, isThinking, attempt + 1);
  }

  return sentence;
}

// WebLLM Hook
// autoLoad: 是否自動載入模型（手機上應設為 false 避免 OOM 崩潰）
export function useWebLLM(autoLoad = true) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('qwen3-1.7b');
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
      
      // 檢查儲存空間（模型約需 1-3GB）
      const modelSizeBytes = modelConfig.size.includes('1.3GB') ? 1.3e9 : 2.2e9;
      const hasStorage = await hasEnoughStorage(modelSizeBytes * 1.5); // 預留 50% buffer
      if (!hasStorage) {
        throw new Error('儲存空間不足，無法下載模型。建議使用雲端 API 模式。');
      }
      
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
      
      // 延遲載入 WebLLM 模組，避免手機上不必要的記憶體佔用
      const webllmLib = await getWebLLM();
      
      // 使用 CreateMLCEngine API
      const engine = await webllmLib.CreateMLCEngine(modelConfig.modelId, {
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
      
      // 友善化錯誤訊息
      let friendlyError = err.message || '模型載入失敗';
      
      if (friendlyError.includes('GPU') || friendlyError.includes('WebGPU')) {
        friendlyError = '❌ 此裝置不支援 WebGPU，請使用「雲端 API」模式';
      } else if (friendlyError.includes('儲存空間')) {
        friendlyError = `❌ ${friendlyError}`; // 已經是友善訊息
      } else if (friendlyError.includes('memory') || friendlyError.toLowerCase().includes('oom')) {
        friendlyError = '❌ 記憶體不足，建議使用「雲端 API」模式或選擇較小的模型';
      } else if (friendlyError.includes('Cannot find model')) {
        friendlyError = `❌ 模型載入失敗：${modelConfig.name} 不存在`;
      } else {
        friendlyError = `❌ ${friendlyError}`;
      }
      
      setError(friendlyError);
      setIsReady(false);
    } finally {
      setIsLoading(false);
      setProgress(null);
      setLoadingModelName(null);
    }
  }, [isClient]);

  // 卸載模型（釋放記憶體，切換到雲端時使用）
  const unloadModel = useCallback(async () => {
    if (chatRef.current) {
      try {
        await chatRef.current.unload();
        console.log('[WebLLM] 🗑️ 模型已卸載，釋放記憶體');
      } catch (e) {
        console.warn('Error unloading engine:', e);
      }
      chatRef.current = null;
    }
    setIsReady(false);
    setError(null);
    setProgress(null);
  }, []);

  // 初始載入默認模型（僅在 autoLoad=true 且非手機時）
  useEffect(() => {
    if (!autoLoad) {
      console.log('[WebLLM] ⏭️ 跳過自動載入（autoLoad=false）');
      return;
    }
    if (shouldUseCloud()) {
      console.log('[WebLLM] ⏭️ 跳過自動載入（偵測到手機/低記憶體裝置）');
      return;
    }
    loadModel('qwen3-1.7b');
  }, [loadModel, autoLoad]);

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

    // 檢查當前模型是否為思考模型
    const currentModelConfig = availableModels.find(m => m.id === currentModel);
    const isThinking = currentModelConfig?.isThinking ?? false;
    if (isThinking) {
      console.log(`[WebLLM] 💭 思考模型偵測到，已啟用 /no_think 模式`);
    }

    for (const { name, prompt } of selectedContexts) {
      try {
        const sentence = await generateOneSentence(chatRef.current, config, word, name, prompt, lang, isThinking);
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
  }, [isReady, currentModel]);

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
    const currentModelConfig = availableModels.find(m => m.id === currentModel);
    const isThinking = currentModelConfig?.isThinking ?? false;
    console.log(`[WebLLM] 🔄 重新生成: "${word}" [${ctx.name}]${isThinking ? ' (no_think)' : ''}`);
    
    try {
      const sentence = await generateOneSentence(chatRef.current, config, word, ctx.name, ctx.prompt, lang, isThinking);
      return sentence;
    } catch (e) {
      console.error('[WebLLM] ❌ Regenerate failed:', e);
      return null;
    }
  }, [isReady, currentModel]);

  return { 
    isReady, 
    isLoading, 
    isGenerating,
    progress, 
    error, 
    currentModel,
    loadingModelName,
    loadModel,
    unloadModel,
    generateSentences,
    regenerateSingle,
    deviceInfo: {
      isMobile: isMobile(),
      hasWebGPU: hasWebGPU(),
      memoryGB: getDeviceMemoryGB(),
      shouldUseCloud: shouldUseCloud(),
    }
  };
}

// ===== OpenRouter API 後端 =====
// 透過 OpenRouter API 生成單條例句（供手機等不支援 WebGPU 的裝置使用）
async function generateOneSentenceAPI(
  apiKey: string,
  config: { systemPrompt: string },
  word: string,
  contextName: string,
  contextPrompt: string,
  lang: string,
  modelId: string,
  attempt = 1
): Promise<Sentence | null> {
  const MAX_ATTEMPTS = 2;
  const sentenceStartTime = performance.now();
  
  const userContent = `單字：「${word}」\n語境：${contextPrompt}\n\n請用「${word}」造一個完整的句子，格式：句子|翻譯 /no_think`;
  
  const messages = [
    { role: 'system', content: config.systemPrompt },
    ...((config as any).fewShot || []),
    { role: 'user', content: userContent }
  ];

  // 使用 AbortController 設定超時，避免 Safari "a problem repeatedly occurred"
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超時

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://lang-learn.vercel.app',
        'X-Title': 'Lang-Learn',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'Unknown error');
      console.error(`[OpenRouter] ❌ HTTP ${res.status}: ${errBody}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 500)); // 短暫延遲避免過快重試
        return generateOneSentenceAPI(apiKey, config, word, contextName, contextPrompt, lang, modelId, attempt + 1);
      }
      return null;
    }

    const data = await res.json();
    const rawGenerated = (data.choices?.[0]?.message?.content || '').trim();
    const generated = stripThinkingTags(rawGenerated);

    const sentenceTime = ((performance.now() - sentenceStartTime) / 1000).toFixed(1);
    console.log(`[OpenRouter] 📝 [${contextName}] ${sentenceTime}s (attempt ${attempt}) - "${rawGenerated.substring(0, 100)}"`);

    let sentence: Sentence | null = null;

    if (generated && generated.includes('|')) {
      const parts = generated.split('|');
      const original = parts[0].trim();
      const translation = parts.slice(1).join('|').trim();
      if (original && translation && original.length > 4 && original.length < 300
          && original !== word && original.length > word.length + 2) {
        sentence = { original, translation, context: contextName };
      }
    }

    if (!sentence && generated && generated.length > 6 && generated.length < 300
        && generated !== word && generated.length > word.length + 2) {
      const translation = await translate(generated, lang);
      sentence = { original: generated, translation, context: contextName };
    }

    if (!sentence && attempt < MAX_ATTEMPTS) {
      console.log(`[OpenRouter] 🔄 輸出不完整，重試第 ${attempt + 1} 次...`);
      await new Promise(r => setTimeout(r, 300));
      return generateOneSentenceAPI(apiKey, config, word, contextName, contextPrompt, lang, modelId, attempt + 1);
    }

    return sentence;
  } catch (e: any) {
    clearTimeout(timeoutId);
    
    // 區分超時錯誤和其他錯誤
    if (e.name === 'AbortError') {
      console.error(`[OpenRouter] ⏱️ 請求超時: [${contextName}]`);
    } else {
      console.error('[OpenRouter] ❌ Fetch error:', e?.message || e);
    }
    
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 500));
      return generateOneSentenceAPI(apiKey, config, word, contextName, contextPrompt, lang, modelId, attempt + 1);
    }
    return null;
  }
}

// OpenRouter Hook（API 模式，手機也能用）
export function useOpenRouter() {
  const [apiKey, setApiKey] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentOpenRouterModel, setCurrentOpenRouterModel] = useState<string>('qwen3-8b');
  const isClient = typeof window !== 'undefined';

  // 優先使用環境變數的 API key（伺服器端設定），否則從 localStorage 讀取
  const serverApiKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_OPENROUTER_API_KEY : undefined;
  const effectiveApiKey = serverApiKey || apiKey;
  const hasServerKey = !!serverApiKey;

  useEffect(() => {
    if (!isClient || hasServerKey) return;
    const saved = localStorage.getItem('lang-learn-openrouter-key');
    if (saved) setApiKey(saved);
    const savedModel = localStorage.getItem('lang-learn-openrouter-model');
    if (savedModel) setCurrentOpenRouterModel(savedModel);
  }, [isClient, hasServerKey]);

  const saveApiKey = useCallback((key: string) => {
    if (hasServerKey) return; // 伺服器端已有 key，不需要儲存
    setApiKey(key);
    if (isClient) {
      if (key) {
        localStorage.setItem('lang-learn-openrouter-key', key);
      } else {
        localStorage.removeItem('lang-learn-openrouter-key');
      }
    }
  }, [isClient, hasServerKey]);

  const setOpenRouterModel = useCallback((modelId: string) => {
    setCurrentOpenRouterModel(modelId);
    if (isClient) {
      localStorage.setItem('lang-learn-openrouter-model', modelId);
    }
  }, [isClient]);

  const isReady = !!effectiveApiKey;

  const generateSentences = useCallback(async (
    word: string,
    lang: string,
    selectedContextIds?: string[],
    onSentence?: (sentence: Sentence) => void
  ): Promise<Sentence[]> => {
    if (!effectiveApiKey) return [];

    setIsGenerating(true);
    const totalStartTime = performance.now();
    console.log(`[OpenRouter] 🔄 開始並行生成例句: "${word}" (${lang})`);

    const config = langConfigs[lang];
    const selectedContexts = selectedContextIds && selectedContextIds.length > 0
      ? allContexts.filter(c => selectedContextIds.includes(c.id))
      : allContexts.slice(0, 5);

    const modelConfig = openRouterModels.find(m => m.id === currentOpenRouterModel);
    const modelIdToUse = modelConfig?.modelId || 'qwen/qwen3-8b';

    // 🚀 Batch Mode: 並行發送所有 API 請求
    const promises = selectedContexts.map(async ({ name, prompt }) => {
      try {
        const sentence = await generateOneSentenceAPI(effectiveApiKey, config, word, name, prompt, lang, modelIdToUse);
        if (sentence && onSentence) {
          onSentence(sentence); // 即時回傳每個完成的結果
        }
        return sentence;
      } catch (e) {
        console.error(`[OpenRouter] ❌ [${name}] 生成失敗:`, e);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const sentences = results.filter((s): s is Sentence => s !== null);

    const totalTime = ((performance.now() - totalStartTime) / 1000).toFixed(1);
    console.log(`[OpenRouter] ✅ 並行生成完成: ${sentences.length}/${selectedContexts.length} 個例句，總耗時 ${totalTime}s`);
    setIsGenerating(false);
    return sentences;
  }, [effectiveApiKey, currentOpenRouterModel]);

  const regenerateSingle = useCallback(async (
    word: string,
    lang: string,
    contextId: string
  ): Promise<Sentence | null> => {
    if (!effectiveApiKey) return null;
    const ctx = allContexts.find(c => c.id === contextId);
    if (!ctx) return null;
    const config = langConfigs[lang];
    console.log(`[OpenRouter] 🔄 重新生成: "${word}" [${ctx.name}]`);
    try {
      const modelConfig = openRouterModels.find(m => m.id === currentOpenRouterModel);
      const modelIdToUse = modelConfig?.modelId || 'qwen/qwen3-8b';
      return await generateOneSentenceAPI(effectiveApiKey, config, word, ctx.name, ctx.prompt, lang, modelIdToUse);
    } catch (e) {
      console.error('[OpenRouter] ❌ Regenerate failed:', e);
      return null;
    }
  }, [effectiveApiKey, currentOpenRouterModel]);

  return {
    isReady,
    isLoading: false,
    isGenerating,
    progress: null as LoadingProgress | null,
    error: effectiveApiKey ? null : '請輸入 OpenRouter API Key',
    currentModel: currentOpenRouterModel,
    loadingModelName: null as string | null,
    apiKey,
    hasServerKey,
    saveApiKey,
    setOpenRouterModel,
    generateSentences,
    regenerateSingle,
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
