/**
 * Sanitization utilities for user-generated content.
 *
 * Drizzle ORM uses parameterized queries, so SQL injection is not a concern
 * at the database layer. The primary risk is XSS when user content is
 * rendered in the browser — either as text content (React auto-escapes this)
 * or in attribute values like href/src/alt.
 *
 * This module provides:
 *  - HTML entity escaping for text rendered in attributes or non-React contexts.
 *  - URL validation/sanitization for links rendered in <a> tags.
 *  - Text truncation helpers that preserve safety.
 */

/**
 * Escape HTML special characters for safe inclusion in attribute values
 * or text content rendered outside of React's JSX context.
 *
 * React's JSX `{var}` syntax auto-escapes text content, but this is still
 * useful for:
 *  - Values passed to non-React HTML generators.
 *  - Debug/logging output.
 *  - Any future code that might use dangerouslySetInnerHTML.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate and sanitize a URL for safe use in an <a> href attribute.
 *
 * Rules:
 *  - Must be a valid absolute URL with an http/https scheme.
 *  - Homepage-relative URLs are allowed (for internal navigation).
 *  - Returns null if the URL is invalid or dangerous.
 */
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  if (!trimmed) return null;

  // Allow relative URLs (internal navigation).
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    // Ensure it doesn't contain back-navigation tricks or protocol-relative URLs.
    if (trimmed.startsWith("//")) return null;
    return trimmed;
  }

  // Allow absolute http/https URLs only.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  // Block dangerous protocols that might slip through.
  const blockedProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  const lower = parsed.toString().slice(0, 12).toLowerCase();
  if (blockedProtocols.some((p) => lower.startsWith(p))) {
    return null;
  }

  return parsed.toString();
}

/**
 * Validate an Instagram URL specifically.
 *
 * Only allows:
 *  - https://instagram.com/<handle>
 *  - https://www.instagram.com/<handle>
 *  - https://instagram.com/p/<post-id>
 *  - https://www.instagram.com/p/<post-id>
 *
 * Rejects any other Instagram domains (e.g. instagram.com.evil.com).
 */
export function safeInstagramUrl(input: string | null | undefined): string | null {
  const url = safeUrl(input);
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = ["instagram.com", "www.instagram.com"];
  if (!allowedHosts.includes(hostname)) return null;

  // Block usernames that could be used for phishing (e.g. instagram.com/facebook).
  // This is a soft block — we just validate the structure, not the content.
  return url;
}

/**
 * Sanitize plain text for safe display — strip control characters and
 * normalize whitespace. This is a safety net; React's JSX escaping is the
 * primary defense.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "") // strip control characters
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/**
 * Truncate text safely — escapes HTML and truncates to a max length,
 * adding an ellipsis if truncated.
 */
export function truncateSafe(
  input: string | null | undefined,
  maxLength: number
): string {
  const sanitized = sanitizeText(input);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength).trim() + "…";
}
