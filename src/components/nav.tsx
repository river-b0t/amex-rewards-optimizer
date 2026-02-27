import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

export function Nav() {
  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-sm tracking-tight">Amex Optimizer</span>
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
          <Link href="/benefits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Benefits</Link>
          <Link href="/optimizer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Optimizer</Link>
          <Link href="/offers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Offers</Link>
          <Link href="/import" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Import</Link>
        </div>
        <div className="ml-auto"><LogoutButton /></div>
      </div>
    </nav>
  )
}
