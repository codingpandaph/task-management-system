import { NextRequest, NextResponse } from 'next/server';
import type { CurrentEmployee } from '@tms/contracts';
import { canOpen } from './features/hr/portal-access';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let user: CurrentEmployee | undefined;
  try {
    const response = await fetch(`${apiOrigin}/api/auth/me`, {
      cache: 'no-store',
      headers: { cookie: request.headers.get('cookie') ?? '', 'x-tms-client': 'web' },
    });
    if (response.ok) user = (await response.json()) as CurrentEmployee;
  } catch {
    if (path === '/login') return NextResponse.next();
  }
  if (!user) return path === '/login' ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  if (user.mustChangePassword && path !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }
  if (path === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (!canOpen(path, user)) return NextResponse.redirect(new URL('/', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
