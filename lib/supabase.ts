import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 用户类型定义
export interface User {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  is_premium: boolean
  daily_quota: number
  created_at: string
}

// 收藏类型定义
export interface Favorite {
  id: string
  user_id: string
  word: string
  sentence_original: string
  sentence_translation: string
  context?: string
  lang: 'ja' | 'en' | 'zh'
  model?: string
  tags?: string[]
  notes?: string
  is_exported: boolean
  created_at: string
}

// 使用记录类型
export interface UsageLog {
  id: string
  user_id: string
  word: string
  lang: string
  model: string
  backend_type: 'webllm' | 'openrouter'
  tokens_used?: number
  created_at: string
}
