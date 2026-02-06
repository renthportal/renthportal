'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import Logo from '@/components/ui/Logo'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function LoginPage({ onLogin, showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      showToast('Email ve şifre gerekli', 'error')
      return
    }
    setLoading(true)
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*, company:companies(*)')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (error || !user) {
        showToast('Kullanıcı bulunamadı', 'error')
        setLoading(false)
        return
      }

      if (!user.is_active) {
        showToast('Hesabınız devre dışı', 'error')
        setLoading(false)
        return
      }

      if (user.password_hash !== password) {
        showToast('Şifre hatalı', 'error')
        setLoading(false)
        return
      }

      await logAudit(user.id, user.full_name, 'LOGIN', { email: user.email })
      showToast('Giriş başarılı!', 'success')
      onLogin(user)
    } catch (err) {
      console.error('Login error:', err)
      showToast('Giriş hatası', 'error')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex justify-center mb-8">
            <div className="bg-[#111] p-4 rounded-xl">
              <Logo size="lg" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Hoş Geldiniz</h1>
          <p className="text-center text-gray-500 mb-8">Hesabınıza giriş yapın</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
              autoComplete="email"
            />
            <Input
              label="Şifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              Giriş Yap
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400">
              Yardıma mı ihtiyacınız var?{' '}
              <a href="mailto:destek@renth.com.tr" className="text-[#C41E3A] hover:underline">
                Destek
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2025 Renth. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  )
}
