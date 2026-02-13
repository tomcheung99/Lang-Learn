'use client'

import { useState, useEffect } from 'react'
import { useAuth, useFavorites } from '@/lib/auth'
import { Favorite } from '@/lib/supabase'
import { 
  Heart, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Edit3, 
  Plus,
  Tag,
  X,
  BookOpen
} from 'lucide-react'

// 分類選項
const CATEGORIES = [
  { id: 'all', name: '全部', icon: '📚' },
  { id: 'daily', name: '日常對話', icon: '💬' },
  { id: 'work', name: '工作場景', icon: '💼' },
  { id: 'emotional', name: '情感表達', icon: '❤️' },
  { id: 'travel', name: '旅遊出行', icon: '✈️' },
  { id: 'academic', name: '學術討論', icon: '🎓' },
  { id: 'business', name: '商務會議', icon: '🤝' },
]

// 語言選項
const LANGUAGES = [
  { id: 'all', name: '全部語言' },
  { id: 'ja', name: '日文' },
  { id: 'en', name: '英文' },
  { id: 'zh', name: '中文' },
]

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading, fetchFavorites, deleteFavorite, updateFavorite } = useFavorites()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedLang, setSelectedLang] = useState('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')

  // 獲取所有唯一標籤
  const allTags = Array.from(
    new Set(favorites.flatMap(f => f.tags || []))
  ).sort()

  // 篩選收藏
  const filteredFavorites = favorites.filter(favorite => {
    // 搜尋文字
    const matchesSearch = 
      searchQuery === '' ||
      favorite.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      favorite.sentence_original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      favorite.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    
    // 分類篩選
    const matchesCategory = 
      selectedCategory === 'all' ||
      favorite.context === selectedCategory
    
    // 語言篩選
    const matchesLang = 
      selectedLang === 'all' ||
      favorite.lang === selectedLang
    
    // 標籤篩選
    const matchesTags = 
      selectedTags.length === 0 ||
      selectedTags.some(tag => favorite.tags?.includes(tag))
    
    return matchesSearch && matchesCategory && matchesLang && matchesTags
  })

  // 載入收藏
  useEffect(() => {
    if (user) {
      fetchFavorites()
    }
  }, [user])

  // 導出 Anki
  const exportToAnki = () => {
    const selectedFavorites = filteredFavorites.filter(f => !f.is_exported)
    
    if (selectedFavorites.length === 0) {
      alert('沒有可導出的新收藏')
      return
    }

    // Anki CSV 格式：正面,背面,標籤
    const csvContent = selectedFavorites.map(f => {
      const front = f.sentence_original
      const back = `${f.sentence_translation}<br><br>單詞：${f.word}<br>語境：${f.context || '一般'}`
      const tags = f.tags?.join(' ') || ''
      return `"${front}","${back}","${tags}"`
    }).join('\n')

    // 下載 CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `lang-learn-anki-${new Date().toISOString().split('T')[0]}.csv`
    link.click()

    // 標記為已導出
    selectedFavorites.forEach(f => {
      updateFavorite(f.id, { is_exported: true })
    })

    alert(`已導出 ${selectedFavorites.length} 條到 Anki！`)
  }

  // 導出所有為 CSV
  const exportAllCSV = () => {
    const csvContent = [
      '單詞,原文,翻譯,語言,語境,標籤,備註,創建日期',
      ...filteredFavorites.map(f => 
        `"${f.word}","${f.sentence_original}","${f.sentence_translation}",${f.lang},${f.context || ''},"${f.tags?.join(',') || ''}","${f.notes || ''}",${f.created_at}`
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `lang-learn-backup-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // 開始編輯備註
  const startEdit = (favorite: Favorite) => {
    setEditingId(favorite.id)
    setEditNotes(favorite.notes || '')
  }

  // 保存備註
  const saveNotes = async (id: string) => {
    await updateFavorite(id, { notes: editNotes })
    setEditingId(null)
    setEditNotes('')
  }

  // 切換標籤選擇
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">請先登入</h2>
          <p className="mt-2 text-gray-600">登入後即可查看和管理您的收藏</p>
          <a 
            href="/login" 
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            前往登入
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 標題區 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="h-8 w-8 text-red-500 fill-red-500" />
            我的收藏
          </h1>
          <p className="mt-2 text-gray-600">
            共 {favorites.length} 條收藏
            {favorites.length >= 100 && (
              <span className="ml-2 text-amber-600 text-sm">
                (免費用戶上限 100 條)
              </span>
            )}
          </p>
        </div>

        {/* 篩選區 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {/* 搜尋 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋單詞、句子或備註..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 分類篩選 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* 語言篩選 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => setSelectedLang(lang.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedLang === lang.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>

          {/* 標籤篩選 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Tag className="h-5 w-5 text-gray-500 mr-2" />
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 rounded text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={exportToAnki}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            導出到 Anki
          </button>
          <button
            onClick={exportAllCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            備份 CSV
          </button>
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <X className="h-4 w-4" />
              清除標籤篩選
            </button>
          )}
        </div>

        {/* 收藏列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Heart className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              {searchQuery || selectedCategory !== 'all' || selectedTags.length > 0
                ? '沒有符合條件的收藏'
                : '還沒有收藏任何例句，快去生成一些吧！'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredFavorites.map((favorite) => (
              <div 
                key={favorite.id} 
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">
                      {favorite.word}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {favorite.lang === 'ja' && '🇯🇵 日文'}
                      {favorite.lang === 'en' && '🇬🇧 英文'}
                      {favorite.lang === 'zh' && '🇨🇳 中文'}
                    </span>
                    {favorite.is_exported && (
                      <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                        已導出
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(favorite)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('確定要刪除這條收藏嗎？')) {
                          deleteFavorite(favorite.id)
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <p className="text-lg text-gray-800">{favorite.sentence_original}</p>
                  <p className="text-gray-600">{favorite.sentence_translation}</p>
                </div>

                {/* 語境和標籤 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {favorite.context && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                      {CATEGORIES.find(c => c.id === favorite.context)?.icon} {' '}
                      {CATEGORIES.find(c => c.id === favorite.context)?.name || favorite.context}
                    </span>
                  )}
                  {favorite.tags?.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* 編輯備註 */}
                {editingId === favorite.id ? (
                  <div className="mt-3">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="添加備註..."
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => saveNotes(favorite.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null)
                          setEditNotes('')
                        }}
                        className="px-3 py-1 text-gray-600 text-sm hover:text-gray-800"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : favorite.notes ? (
                  <p className="mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                    📝 {favorite.notes}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-gray-400">
                  {new Date(favorite.created_at).toLocaleDateString('zh-HK')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
