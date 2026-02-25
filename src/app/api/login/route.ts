import { NextRequest, NextResponse } from 'next/server'

  export async function POST(request: NextRequest) {
    const { password } = await request.json()
    const envPassword = process.env.SITE_PASSWORD

    console.log('submitted:', password)
    console.log('env:', envPassword)

    if (password !== envPassword) {
      return NextResponse.json({ error: 'Incorrect password', submitted: password, env: envPassword
   }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('site-auth', process.env.SITE_PASSWORD!, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  }
