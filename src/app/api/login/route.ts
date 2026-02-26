import { NextRequest, NextResponse } from 'next/server'

  export async function POST(request: NextRequest) {
    const formData = await request.formData()
    const password = formData.get('password') as string

    if (password !== process.env.SITE_PASSWORD) {
      return NextResponse.redirect(new URL('/login?error=1', request.url))
    }

    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('site-auth', process.env.SITE_PASSWORD!, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  }
