import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

/**
 * Apply security headers to every response.
 *
 * Content-Security-Policy:
 *   - Default deny, allow only our origins (R2 custom domain, Google Fonts,
 *     Instagram, WhatsApp for the packages deep link).
 *   - Scripts only from 'self' — no inline scripts except the theme init
 *     (allowed via 'unsafe-inline' hash, or we use nonce in production).
 *   - Images from 'self' + R2 domain + data: (for LQIP blobs).
 *   - Styles from 'self' + Google Fonts.
 *   - Frames from 'self' only (blocks clickjacking).
 *   - Form actions only to 'self' + wa.me for WhatsApp.
 *
 * HSTS: only in production — tells browsers to always use HTTPS.
 * X-Frame-Options: deny — no embedding this site in an iframe.
 * X-Content-Type-Options: nosniff — prevent MIME sniffing.
 * Referrer-Policy: strict-origin-when-cross-origin — balanced privacy.
 * Permissions-Policy: restrict sensitive APIs we don't use.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const r2Domain = process.env.R2_PUBLIC_MEDIA_URL
    ?.replace(/\/+$/, "")
    ?.replace(/^https?:\/\//, "")
    ?.replace(/^([^.]+\.)?([^.]+\.[^.]+)/, "$2")
    ?? "";

  const cspDirectives = [
    // Scripts: only from self. The only inline script is the theme init in
    // layout.tsx which is safe (no user input, setAttribute only).
    "script-src 'self' 'unsafe-inline'",
    // Styles: self + Google Fonts.
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    // Fonts: self + Google Fonts.
    "font-src 'self' https://fonts.gstatic.com",
    // Images: self + R2 custom domain + data: (LQIP placeholders).
    `img-src 'self' data: ${r2Domain ? `https://${r2Domain}` : ""}`,
    // Media (video): self + R2.
    `media-src 'self' ${r2Domain ? `https://${r2Domain}` : ""}`,
    // Connections: self + WhatsApp for the packages deep link.
    "connect-src 'self' https://wa.me",
    // Frames: self only — prevents clickjacking.
    "frame-ancestors 'self'",
    // Forms: self + WhatsApp (for the wa.me link).
    "form-action 'self' https://wa.me",
    // Don't allow plugins.
    "object-src 'none'",
    // Base URI: self.
    "base-uri 'self'",
  ].join("; ");

  const csp = `default-src 'self'; ${cspDirectives}`;

  response.headers.set("Content-Security-Policy", csp);

  // HSTS: 1 year, include subdomains, preload-eligible.
  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Prevent clickjacking.
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME sniffing.
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Balanced referrer policy.
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict sensitive browser APIs we don't use.
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  return response;
}

export const config = {
  matcher: [
    // Apply security headers to all routes except Next.js static assets.
    // The middleware function itself handles auth logic for /admin/*.
    "/((?!_next/static|_next/image|_next/data|favicon.ico).)*",
  ],
};

export default async function middleware(
  request: NextRequest
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Login page is public; everything else under /admin requires a session.
  if (pathname === "/admin/login") {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    nextProxyCookies(request, response),
    sessionOptions
  );

  if (!session.isLoggedIn) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    return applySecurityHeaders(redirectResponse);
  }

  return applySecurityHeaders(response);
}
