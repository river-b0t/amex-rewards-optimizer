'use client'

export function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Log out
    </button>
  )
}
