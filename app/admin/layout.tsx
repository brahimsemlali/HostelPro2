import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Toaster } from '@/components/ui/sonner'
import { Shield, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(',').filter(Boolean)

  if (!user || !superadminEmails.includes(user.email ?? '')) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-[#F4F6F8]">
      <aside className="w-56 bg-[#0A1F1C] flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0F6E56] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Admin Panel</p>
              <p className="text-white/40 text-[10px] leading-tight truncate">Sweet Reservation</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 text-sm transition-colors"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Vue d&apos;ensemble
          </Link>
        </nav>

        <div className="p-4 border-t border-white/8">
          <p className="text-white/30 text-[10px] mb-2 truncate">{user.email}</p>
          <Link href="/dashboard" className="text-white/40 text-xs hover:text-white/70 transition-colors">
            ← Dashboard hostel
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      <Toaster richColors position="top-right" />
    </div>
  )
}
