import { format, parse } from "date-fns";

/**
 * Format a PostgreSQL date/timestamp as "Month Year" (e.g. "October 2026").
 * The DB stores `date` as a timestamp — we extract just the month and year.
 */
export function formatDateAsMonthYear(date: Date | string): string {
  const d = typeof date === "string" ? parse(date, "yyyy-MM-dd", new Date()) : date;
  return format(d, "MMMM yyyy");
}

/**
 * Format a PostgreSQL date/timestamp as "DD/MM/YYYY" (e.g. "10/10/2026").
 * Used in the admin panel for full date display.
 */
export function formatDateFull(date: Date | string): string {
  const d = typeof date === "string" ? parse(date, "yyyy-MM-dd", new Date()) : date;
  return format(d, "dd/MM/yyyy");
}
