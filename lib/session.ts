import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  email?: string;
  isLoggedIn?: boolean;
}

export const sessionOptions: SessionOptions = {
  cookieName: "portfolio_admin_session",
  password: process.env.SESSION_SECRET ?? "",
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

/** Reads the current session from the request cookies (Server Actions, Route Handlers, Server Components). */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Returns the session only when the visitor is an authenticated admin, otherwise null. */
export async function requireAdminSession() {
  const session = await getSession();
  return session.isLoggedIn ? session : null;
}
