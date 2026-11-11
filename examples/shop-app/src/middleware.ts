import { db } from './lib/db';

export function middleware() {
  void db;
}

export const config = { matcher: ['/dashboard/:path*', '/api/:path*'] };
