import { redirect } from 'next/navigation'

// This route group is superseded by app/admin/page.tsx at /admin
export default function AdminRouteGroupRedirect() {
  redirect('/admin')
}
