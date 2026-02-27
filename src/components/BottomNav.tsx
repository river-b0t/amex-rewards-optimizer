'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Gift, Zap, Tag, Upload } from 'lucide-react'

const TABS = [
  { href: '/',          label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/benefits',  label: 'Benefits',  Icon: Gift            },
  { href: '/optimizer', label: 'Optimizer', Icon: Zap             },
  { href: '/offers',    label: 'Offers',    Icon: Tag             },
  { href: '/import',    label: 'Import',    Icon: Upload          },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 pb-safe">
      <div className="flex items-stretch h-16">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors',
                active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600',
              ].join(' ')}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
