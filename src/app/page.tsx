"use client";

import { useState, useEffect } from "react";
import { Search, Volume2, BookOpen, Sparkles, History, X } from "lucide-react";

// 模擬例句數據庫
const sentenceDatabase: Record<string, Record<string, { sentences: Array<{ original: string; translation: string; pronunciation?: string }>; meaning: string; reading?: string }>> = {
  // 日語
  ja: {
    "愛": {
      meaning: "愛、愛情",
      reading: "あい (ai)",
      sentences: [
        { original: "愛は世界を救う。", translation: "愛能拯救世界。", pronunciation: "Ai wa sekai wo sukuu." },
        { original: "彼女は家族を深く愛している。", translation: "她深愛著家人。", pronunciation: "Kanojo wa kazoku wo fukaku aishite iru." },
        { original: "愛することは恐れることではない。", translation: "去愛並不可怕。", pronunciation: "Ai suru koto wa osoreru koto de wa nai." },
      ],
    },
    "夢": {
      meaning: "夢想、夢境",
      reading: "ゆめ (yume)",
      sentences: [
        { original: "夢を追いかけ続けなさい。", translation: "繼續追逐你的夢想。", pronunciation: "Yume wo oikake tsudzukenasai." },
        { original: "昨夜、不思議な夢を見た。", translation: "昨晚做了個奇怪的夢。", pronunciation: "Sakuya, fushigi na yume wo mita." },
        { original: "夢が現実になった。", translation: "夢想成真了。", pronunciation: "Yume ga genjitsu ni natta." },
      ],
    },
    "時間": {
      meaning: "時間",
      reading: "じかん (jikan)",
      sentences: [
        { original: "時間は金なり。", translation: "時間就是金錢。", pronunciation: "Jikan wa kane nari." },
        { original: "もう少し時間が欲しい。", translation: "想要多一點時間。", pronunciation: "Mou sukoshi jikan ga hoshii." },
        { original: "時間が経つのは早い。", translation: "時間過得很快。", pronunciation: "Jikan ga tatsu no wa hayai." },
      ],
    },
    "猫": {
      meaning: "貓",
      reading: "ねこ (neko)",
      sentences: [
        { original: "猫がソファで寝ている。", translation: "貓在沙發上睡覺。", pronunciation: "Neko ga sofua de nete iru." },
        { original: "私は猫が大好きです。", translation: "我非常喜歡貓。", pronunciation: "Watashi wa neko ga daisuki desu." },
        { original: "その猫はとても可愛い。", translation: "那隻貓很可愛。", pronunciation: "Sono neko wa totemo kawaii." },
      ],
    },
    "本": {
      meaning: "書",
      reading: "ほん (hon)",
      sentences: [
        { original: "本を読むのが好きです。", translation: "喜歡讀書。", pronunciation: "Hon wo yomu no ga suki desu." },
        { original: "この本はとても面白い。", translation: "這本書很有趣。", pronunciation: "Kono hon wa totemo omoshiroi." },
        { original: "図書館で本を借りた。", translation: "在圖書館借了書。", pronunciation: "Toshokan de hon wo karita." },
      ],
    },
  },
  // 英語
  en: {
    "serendipity": {
      meaning: "意外發現珍貴事物的能力；機緣巧合",
      sentences: [
        { original: "Finding this café was pure serendipity.", translation: "發現這家咖啡館純屬機緣巧合。", pronunciation: "/ˌser.ənˈdɪp.ə.ti/" },
        { original: "Serendipity often leads to the best discoveries.", translation: "意外發現往往帶來最好的收穫。", pronunciation: "/ˌser.ənˈdɪp.ə.ti/" },
        { original: "I love the serendipity of travel.", translation: "我喜歡旅行中的意外驚喜。", pronunciation: "/ˌser.ənˈdɪp.ə.ti/" },
      ],
    },
    "ephemeral": {
      meaning: "短暫的、轉瞬即逝的",
      sentences: [
        { original: "Beauty is ephemeral.", translation: "美麗是短暫的。", pronunciation: "/ɪˈfem.ər.əl/" },
        { original: "Social media trends are often ephemeral.", translation: "社交媒體趨勢通常是短暫的。", pronunciation: "/ɪˈfem.ər.əl/" },
        { original: "Life is ephemeral, cherish every moment.", translation: "生命轉瞬即逝，珍惜每一刻。", pronunciation: "/ɪˈfem.ər.əl/" },
      ],
    },
    "love": {
      meaning: "愛、愛情",
      sentences: [
        { original: "Love conquers all.", translation: "愛能征服一切。", pronunciation: "/lʌv/" },
        { original: "I love learning new languages.", translation: "我喜歡學習新語言。", pronunciation: "/lʌv/" },
        { original: "Love is patient, love is kind.", translation: "愛是恆久忍耐，又有恩慈。", pronunciation: "/lʌv/" },
      ],
    },
    "time": {
      meaning: "時間",
      sentences: [
        { original: "Time flies when you're having fun.", translation: "快樂的時光過得特別快。", pronunciation: "/taɪm/" },
        { original: "I need more time.", translation: "我需要更多時間。", pronunciation: "/taɪm/" },
        { original: "Time heals all wounds.", translation: "時間治癒一切傷痛。", pronunciation: "/taɪm/" },
      ],
    },
    "dream": {
      meaning: "夢想、夢境",
      sentences: [
        { original: "Never give up on your dreams.", translation: "永遠不要放棄你的夢想。", pronunciation: "/driːm/" },
        { original: "I had a strange dream last night.", translation: "我昨晚做了個奇怪的夢。", pronunciation: "/driːm/" },
        { original: "Dream big and work hard.", translation: "敢於夢想，努力實現。", pronunciation: "/driːm/" },
      ],
    },
  },
  // 中文
  zh: {
    "夢": {
      meaning: "夢想、夢境",
      reading: "mèng",
      sentences: [
        { original: "追逐夢想永不放棄。", translation: "Chase dreams and never give up.", pronunciation: "zhuī zhú mèng xiǎng yǒng bù fàng qì" },
        { original: "昨晚我做了一個美夢。", translation: "I had a beautiful dream last night.", pronunciation: "zuó wǎn wǒ zuò le yí gè měi mèng" },
        { original: "夢想成真需要努力。", translation: "Making dreams come true requires effort.", pronunciation: "mèng xiǎng chéng zhēn xū yào nǔ lì" },
      ],
    },
    "愛": {
      meaning: "愛、愛情",
      reading: "ài",
      sentences: [
        { original: "愛能戰勝一切。", translation: "Love conquers all.", pronunciation: "ài néng zhàn shèng yí qiè" },
        { original: "母愛是最偉大的。", translation: "Mother's love is the greatest.", pronunciation: "mǔ ài shì zuì wěi dà de" },
        { original: "我愛學習新語言。", translation: "I love learning new languages.", pronunciation: "wǒ ài xué xí xīn yǔ yán" },
      ],
    },
    "時間": {
      meaning: "時間",
      reading: "shí jiān",
      sentences: [
        { original: "時間就是金錢。", translation: "Time is money.", pronunciation: "shí jiān jiù shì jīn qián" },
        { original: "時間過得很快。", translation: "Time passes quickly.", pronunciation: "shí jiān guò de hěn kuài" },
        { original: "請給我多一點時間。", translation: "Please give me more time.", pronunciation: "qǐng gěi wǒ duō yì diǎn shí jiān" },
      ],
    },
  },
};

// 自動生成例句 (當數據庫沒有時)
function generateSentences(word: string, lang: string): Array<{ original: string; translation: string; pronunciation?: string }> {
  const templates: Record<string, string[]> = {
    ja: [
      `{word}について考えています。`,
      `{word}はとても重要です。`,
      `{word}を勉強しています。`,
    ],
    en: [
      `I am thinking about {word}.`,
      `{word} is very important.`,
      `I am learning about {word}.`,
    ],
    zh: [
      `我在思考{word}。`,
      `{word}非常重要。`,
      `我正在學習{word}。`,
    ],
  };
  
  const translations: Record<string, string[]> = {
    ja: ["我正在思考{word}。", "{word}非常重要。", "我正在學習{word}。"],
    en: ["我在思考{word}。", "{word}非常重要。", "我正在學習{word}。"],
    zh: ["I'm thinking about {word}.", "{word} is very important.", "I'm learning about {word}."],
  };

  const langTemplates = templates[lang] || templates.en;
  const langTranslations = translations[lang] || translations.en;
  
  return langTemplates.map((template, i) => ({
    original: template.replace(/{word}/g, word),
    translation: langTranslations[i]?.replace(/{word}/g, word) || "",
  }));
}

export default function LangLearn() {
  const [input, setInput] = useState("");
  const [selectedLang, setSelectedLang] = useState<"ja" | "en" | "zh">("ja");
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 載入歷史記錄
  useEffect(() => {
    const saved = localStorage.getItem("lang-learn-history");
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  // 保存歷史記錄
  useEffect(() => {
    localStorage.setItem("lang-learn-history", JSON.stringify(history));
  }, [history]);

  const handleSearch = () => {
    if (!input.trim()) return;
    
    setIsSearching(true);
    
    // 模擬 API 延遲
    setTimeout(() => {
      const langData = sentenceDatabase[selectedLang];
      const wordData = langData?.[input.trim()];
      
      if (wordData) {
        setResult({
          word: input.trim(),
          ...wordData,
          isGenerated: false,
        });
      } else {
        // 生成通用例句
        const generated = generateSentences(input.trim(), selectedLang);
        setResult({
          word: input.trim(),
          meaning: "（自動生成）",
          sentences: generated,
          isGenerated: true,
        });
      }
      
      // 添加到歷史
      if (!history.includes(input.trim())) {
        setHistory(prev => [input.trim(), ...prev].slice(0, 20));
      }
      
      setIsSearching(false);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const playAudio = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLang === "ja" ? "ja-JP" : selectedLang === "zh" ? "zh-TW" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("lang-learn-history");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center pt-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            <Sparkles className="inline-block w-8 h-8 mr-2 text-yellow-400" />
            一字學習
          </h1>
          <p className="text-purple-200">打一個字，學一句話</p>
        </div>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mb-6">
          {([
            { code: "ja", label: "日本語", emoji: "🇯🇵" },
            { code: "en", label: "English", emoji: "🇬🇧" },
            { code: "zh", label: "中文", emoji: "🇹🇼" },
          ] as const).map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLang(lang.code)}
              className={`px-4 py-2 rounded-full transition-all ${
                selectedLang === lang.code
                  ? "bg-white text-purple-900 font-semibold shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {lang.emoji} {lang.label}
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
            placeholder={selectedLang === "ja" ? "輸入日文..." : selectedLang === "zh" ? "輸入中文..." : "Type English..."}
            className="w-full px-6 py-4 pr-14 text-lg bg-white/10 backdrop-blur border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-purple-500 hover:bg-purple-400 disabled:bg-white/10 rounded-xl transition-colors"
          >
            <Search className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mb-8 bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Word Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">{result.word}</h2>
                  {result.reading && (
                    <p className="text-purple-300 text-lg">{result.reading}</p>
                  )}
                  <p className="text-white/70 mt-2">{result.meaning}</p>
                </div>
                <button
                  onClick={() => playAudio(result.word)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <Volume2 className="w-6 h-6 text-white" />
                </button>
              </div>
              {result.isGenerated && (
                <span className="inline-block mt-3 px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                  自動生成例句
                </span>
              )}
            </div>

            {/* Sentences */}
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-white/80 font-semibold mb-4">
                <BookOpen className="w-5 h-5" />
                例句
              </h3>
              <div className="space-y-4">
                {result.sentences.map((sentence: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white text-lg mb-1">{sentence.original}</p>
                        {sentence.pronunciation && (
                          <p className="text-purple-300 text-sm mb-2">{sentence.pronunciation}</p>
                        )}
                        <p className="text-white/60">{sentence.translation}</p>
                      </div>
                      <button
                        onClick={() => playAudio(sentence.original)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Volume2 className="w-4 h-4 text-white" />
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
              {history.map((word) => (
                <button
                  key={word}
                  onClick={() => {
                    setInput(word);
                    setTimeout(handleSearch, 100);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm transition-colors"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-white/30 text-sm mt-8 pb-8">
          輸入任意單字，立即獲取例句和讀音
        </p>
      </div>
    </div>
  );
}
