import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names and merges Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string to a human-readable format
 */
export function formatDate(date: Date | string): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;

  // Check if the date is today
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  // Check if the date is yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  // Format the time
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  };
  const timeString = d.toLocaleTimeString(undefined, timeOptions);

  if (isToday) {
    return `Today at ${timeString}`;
  } else if (isYesterday) {
    return `Yesterday at ${timeString}`;
  } else {
    // Format the date
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined
    };
    return `${d.toLocaleDateString(undefined, dateOptions)} at ${timeString}`;
  }
}