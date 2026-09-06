import { sanitizeText } from "@/lib/sanitize";

/**
 * SafeText renders user-generated text content safely.
 *
 * React's JSX `{var}` syntax already escapes HTML entities in text content,
 * so XSS via text content is not a real risk here. This component exists as
 * a defense-in-depth measure and to make the intent explicit in the codebase:
 * any text that comes from user input (project title, description, alt text,
 * location, etc.) should pass through SafeText.
 *
 * For attribute values (href, alt, title, etc.), use the sanitization
 * helpers in lib/sanitize.ts directly.
 */
export default function SafeText({
  children,
  className,
  ...props
}: {
  children: string | null | undefined;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const safe = children != null ? sanitizeText(String(children)) : "";
  return (
    <span className={className} {...props}>
      {safe}
    </span>
  );
}
