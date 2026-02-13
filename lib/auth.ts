'use client'

import { useState, useEffect } from 'react'
import { supabase, User, Favorite } from './supabase'
import { User as SupabaseUser } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (!error && data) {
      setProfile(data as User)
    }
  }

  // 发送 Magic Link
  const signInWithOtp = async (email: string) => {
    // 使用生產環境 URL（避免 localhost 問題）
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || 
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback')
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    })
    return { error }
  }

  // 登出
  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // 获取今日使用量
  const getTodayUsage = async (): Promise<number> => {
    if (!user) return 0
    
    const { data, error } = await supabase
      .rpc('get_today_usage', { user_uuid: user.id })
    
    return data || 0
  }

  return {
    user,
    profile,
    loading,
    signInWithOtp,
    signOut,
    getTodayUsage
  }
}

// 收藏相关 hooks
export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFavorites = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setFavorites(data as Favorite[])
    }
    setLoading(false)
  }

  const addFavorite = async (favorite: Omit<Favorite, 'id' | 'created_at' | 'user_id'>) => {
    const { data, error } = await supabase
      .from('favorites')
      .insert([favorite])
      .select()
      .single()
    
    if (!error && data) {
      setFavorites(prev => [data as Favorite, ...prev])
    }
    
    return { data, error }
  }

  const deleteFavorite = async (id: string) => {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', id)
    
    if (!error) {
      setFavorites(prev => prev.filter(f => f.id !== id))
    }
    
    return { error }
  }

  const updateFavorite = async (id: string, updates: Partial<Favorite>) => {
    const { data, error } = await supabase
      .from('favorites')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data) {
      setFavorites(prev => prev.map(f => f.id === id ? data as Favorite : f))
    }
    
    return { data, error }
  }

  return {
    favorites,
    loading,
    fetchFavorites,
    addFavorite,
    deleteFavorite,
    updateFavorite
  }
}
