export const ADMIN_EMAIL_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

/** True when Supabase rejects an auth email request because of rate limiting. */
export function isEmailRateLimitError(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || '');
  const status = Number(error?.status || error?.statusCode || 0);
  return status === 429 || /rate[\s_-]*limit|too many requests|over_email_send_rate_limit|email rate limit exceeded|\b429\b/i.test(`${message} ${code}`);
}

/** Format a remaining duration as a readable countdown. */
export function formatCooldownDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
