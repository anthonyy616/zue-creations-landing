/**
 * Site-wide configuration. Values are read once at build/request time from
 * env vars; the fallbacks keep the public site renderable before any of them
 * are set (links are hidden rather than broken).
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Zue Creatives";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

/** Global Instagram profile URL; empty until the client provides it. */
export const INSTAGRAM_URL = (process.env.NEXT_PUBLIC_INSTAGRAM_URL || "").replace(/\/$/, "");
export const INSTAGRAM_HANDLE = process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || "";

/** Where the enquiry flow starts (Google Form). */
export const ENQUIRY_FORM_URL = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL || "";
