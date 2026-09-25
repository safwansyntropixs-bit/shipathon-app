/**
 * Centralized Error Sanitizer and User-Friendly Message Formatter.
 * Ensures non-technical users never see raw runtime errors like "TypeError: Network request failed".
 */

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const raw = typeof error === "string" ? error : error?.message || error?.error_description || String(error);
  const lower = raw.toLowerCase();

  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("typeerror: network") ||
    lower.includes("networkerror") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("offline") ||
    lower.includes("is not connected to internet") ||
    lower.includes("the internet connection appears to be offline")
  );
}

export function formatUserErrorMessage(
  error: any,
  fallbackMessage: string = "Something went wrong. Please try again."
): string {
  if (!error) return fallbackMessage;

  const raw = typeof error === "string" ? error : error?.message || error?.error_description || String(error);
  const lower = raw.toLowerCase();

  // 1. Network / Offline Errors
  if (isNetworkError(error)) {
    return "You're offline. Please check your internet connection and try again.";
  }

  // 2. Auth / Account Credentials
  if (lower.includes("invalid login credentials") || lower.includes("invalid grant")) {
    return "Invalid email or password.";
  }
  if (lower.includes("user not found") || lower.includes("user does not exist") || lower.includes("email not found")) {
    return "No account found with this email address.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("security purposes")
  ) {
    return "Too many attempts. Please wait a moment before trying again.";
  }
  if (
    lower.includes("token has expired") ||
    lower.includes("invalid otp") ||
    lower.includes("token is invalid") ||
    lower.includes("otp expired")
  ) {
    return "Invalid or expired verification code.";
  }
  if (
    lower.includes("email already registered") ||
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("user_already_exists")
  ) {
    return "An account with this email already exists.";
  }

  // 3. Session / Token expiration
  if (lower.includes("jwt expired") || lower.includes("session expired")) {
    return "Session expired. Please sign in again.";
  }

  // 4. Server configuration / 500 errors
  if (
    lower.includes("status:500") ||
    lower.includes('"status":500') ||
    lower.includes("internal server error") ||
    lower.includes("smtp")
  ) {
    return "Server is currently experiencing issues. Please try again shortly.";
  }

  // 5. JSON Error string unpacking
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      const extracted = parsed.msg || parsed.message || parsed.error_description;
      if (extracted) return formatUserErrorMessage(extracted, fallbackMessage);
    } catch {
      // ignore parse failure
    }
  }

  // 6. Generic JS runtime exceptions (TypeError, ReferenceError, SyntaxError)
  if (
    raw.startsWith("TypeError:") ||
    raw.startsWith("ReferenceError:") ||
    raw.startsWith("SyntaxError:") ||
    raw.length > 120
  ) {
    return fallbackMessage;
  }

  return raw;
}
