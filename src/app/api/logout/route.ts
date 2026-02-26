import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('site-auth', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  })
  return response
}
