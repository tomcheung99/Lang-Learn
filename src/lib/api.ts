// 多語言例句 API 整合

const API_BASE = "https://api.mymemory.translated.net";

// 獲取翻譯
export async function getTranslation(text: string, from: string, to: string): Promise<string> {
  try {
    const response = await fetch(
      `${API_BASE}/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
    );
    const data = await response.json();
    return data.responseData?.translatedText || "";
  } catch {
    return "";
  }
}

// 獲取例句 (使用 Tatoeba API - 開源例句庫)
export async function getExampleSentences(word: string, lang: string): Promise<Array<{
  original: string;
  translation: string;
  pronunciation?: string;
}>> {
  try {
    // Tatoeba API
    const fromLang = lang === "ja" ? "jpn" : lang === "zh" ? "cmn" : "eng";
    const toLang = lang === "ja" || lang === "zh" ? "eng" : "cmn";
    
    const response = await fetch(
      `https://tatoeba.org/en/api_v0/search?query=${encodeURIComponent(word)}&from=${fromLang}&to=${toLang}&limit=5`
    );
    const data = await response.json();
    
    if (data.results?.length > 0) {
      return data.results.slice(0, 3).map((result: any) => ({
        original: result.text,
        translation: result.translations?.[0]?.[0]?.text || "",
        pronunciation: "",
      }));
    }
  } catch {
    // 回退到本地生成
  }
  
  return [];
}

// 獲取讀音 (使用 Google Translate TTS 或類似服務)
export function getAudioUrl(text: string, lang: string): string {
  const langCode = lang === "ja" ? "ja-JP" : lang === "zh" ? "zh-TW" : "en-US";
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=tw-ob`;
}

// 增強的例句生成 - 更多樣板
export function generateSmartSentences(word: string, lang: string): Array<{
  original: string;
  translation: string;
  pronunciation?: string;
}> {
  const templates: Record<string, Array<{ template: string; translation: string; context: string }>> = {
    ja: [
      { template: `昨日、{word}について考えていた。`, translation: `昨天我一直在思考關於{word}的事。`, context: "思考" },
      { template: `{word}は私の人生に大きな影響を与えた。`, translation: `{word}對我的人生產生了重大影響。`, context: "影響" },
      { template: `友達と{word}の話をした。`, translation: `我和朋友聊了關於{word}的話題。`, context: "交流" },
      { template: `毎日、{word}に触れることが大切だ。`, translation: `每天接觸{word}是很重要的。`, context: "日常" },
      { template: `{word}を通じて新しい世界が開けた。`, translation: `透過{word}開啟了新的世界。`, context: "發現" },
      { template: `子供の頃から{word}が好きだった。`, translation: `從小時候起就喜歡{word}。`, context: "回憶" },
      { template: `{word}について本を読んでいる。`, translation: `正在讀關於{word}的書。`, context: "學習" },
      { template: `{word}のおかげで成長できた。`, translation: `多虧了{word}我才能成長。`, context: "感恩" },
    ],
    en: [
      { template: `Yesterday, I kept thinking about {word}.`, translation: `昨天我一直在思考關於{word}的事。`, context: "thinking" },
      { template: `{word} has had a profound impact on my life.`, translation: `{word}對我的人生產生了深遠的影響。`, context: "impact" },
      { template: `I had a conversation with my friend about {word}.`, translation: `我和朋友聊了關於{word}的話題。`, context: "conversation" },
      { template: `It's important to engage with {word} every day.`, translation: `每天接觸{word}是很重要的。`, context: "daily" },
      { template: `{word} opened up a whole new world for me.`, translation: `{word}為我開啟了全新的世界。`, context: "discovery" },
      { template: `I've loved {word} since I was a child.`, translation: `從小時候起我就喜愛{word}。`, context: "childhood" },
      { template: `I'm reading a book about {word}.`, translation: `我正在讀關於{word}的書。`, context: "reading" },
      { template: `Thanks to {word}, I've been able to grow.`, translation: `多虧了{word}我才能成長。`, context: "gratitude" },
    ],
    zh: [
      { template: `昨天我一直在思考關於{word}的事。`, translation: `Yesterday, I kept thinking about {word}.`, context: "thinking" },
      { template: `{word}對我的人生產生了重大影響。`, translation: `{word} has had a significant impact on my life.`, context: "impact" },
      { template: `我和朋友聊了關於{word}的話題。`, translation: `I had a conversation with my friend about {word}.`, context: "conversation" },
      { template: `每天接觸{word}是很重要的。`, translation: `It's important to engage with {word} every day.`, context: "daily" },
      { template: `透過{word}我發現了新的世界。`, translation: `Through {word}, I discovered a new world.`, context: "discovery" },
      { template: `從小時候起我就喜歡{word}。`, translation: `I've loved {word} since I was a child.`, context: "childhood" },
      { template: `我正在讀一本關於{word}的書。`, translation: `I'm reading a book about {word}.`, context: "reading" },
      { template: `多虧了{word}，我才能成長。`, translation: `Thanks to {word}, I've been able to grow.`, context: "gratitude" },
    ],
  };

  const langTemplates = templates[lang] || templates.en;
  
  // 隨機選擇 3 個不同的模板
  const shuffled = [...langTemplates].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);
  
  return selected.map(({ template, translation }) => ({
    original: template.replace(/{word}/g, word),
    translation: translation.replace(/{word}/g, word),
  }));
}

// 獲取單字詳情 (整合多個來源)
export async function getWordDetails(word: string, lang: string): Promise<{
  meaning: string;
  reading?: string;
  sentences: Array<{ original: string; translation: string; pronunciation?: string }>;
}> {
  // 1. 嘗試從 API 獲取真實例句
  const apiSentences = await getExampleSentences(word, lang);
  
  if (apiSentences.length > 0) {
    return {
      meaning: "（來自真實語料庫）",
      sentences: apiSentences,
    };
  }
  
  // 2. 回退到智能生成
  const generated = generateSmartSentences(word, lang);
  
  return {
    meaning: "（自動生成例句）",
    sentences: generated,
  };
}
