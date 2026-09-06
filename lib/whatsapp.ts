import type { PackageDef } from "./packages";

/**
 * Build a wa.me deep link with a pre-filled message for the enquiry flow.
 *
 * The message is URL-encoded and opens WhatsApp Web (desktop) or the app
 * (mobile) with the text pre-filled. The recipient number comes from the
 * env; the sender is the visitor's own number (entered on the enquiry page
 * or inferred on mobile).
 */

export const DEFAULT_WA_NUMBER = (process.env.WHATSAPP_PHONE_NUMBER ?? "").replace(
  /[^\d]/g,
  ""
);

export function buildWhatsAppUrl(
  message: string,
  number?: string
): string {
  const target = number ?? DEFAULT_WA_NUMBER;
  if (!target) {
    // No number configured — fall back to a generic wa.me without a target
    // so the visitor can pick their own contact on the WhatsApp landing.
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

/**
 * Build the enquiry message text for one or more selected packages.
 *
 * Keeps the message concise and scannable — project context first, then the
 * package picks with names and prices, then a prompt for the rest of the
 * details. Visitor-supplied fields (name, project type, budget, timeline)
 * are inserted where provided.
 */
export function enquiryMessage({
  name,
  projectType,
  packages,
  budget,
  timeline,
  extra,
}: {
  name?: string;
  projectType?: string;
  packages: PackageDef[];
  budget?: string;
  timeline?: string;
  extra?: string;
}): string {
  const lines: string[] = [];

  lines.push("🔹 New enquiry");
  if (name) lines.push(`Name: ${name}`);
  if (projectType) lines.push(`Project type: ${projectType}`);
  if (packages.length > 0) {
    lines.push("Packages interested in:");
    for (const pkg of packages) {
      lines.push(`• ${pkg.name} — ${pkg.price} (${pkg.tier})`);
    }
  }
  if (budget) lines.push(`Budget: ${budget}`);
  if (timeline) lines.push(`Timeline: ${timeline}`);
  if (extra) lines.push(`Notes: ${extra}`);
  lines.push("");
  lines.push(
    "Get back to me with availability and next steps. Thanks!"
  );

  return lines.join("\n");
}

/** How many packages are currently selected in the client picker. */
export function selectedCount(packages: PackageDef[]): number {
  return packages.length;
}
