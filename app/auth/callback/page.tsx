'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('處理中...')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase 会自动处理 URL 中的 token
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          setStatus('登入失敗：' + error.message)
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        if (session) {
          setStatus('登入成功！正在跳轉...')
          router.push('/')
        } else {
          setStatus('無效的登入連結')
          setTimeout(() => router.push('/login'), 3000)
        }
      } catch (error) {
        setStatus('發生錯誤，請重試')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-lg text-gray-600">{status}</p>
      </div>
    </div>
  )
}
