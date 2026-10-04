// Input validation for register/login. Returns an error message or null.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateName(name: unknown): string | null {
  if (typeof name !== "string") return "Enter your name.";
  const trimmed = name.trim();
  if (trimmed.length < 1) return "Enter your name.";
  if (trimmed.length > 80) return "Name must be 80 characters or fewer.";
  return null;
}

export function validateEmail(email: unknown): string | null {
  if (typeof email !== "string") return "Enter your email address.";
  const normalized = normalizeEmail(email);
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Enter a password.";
  if (password.length < 10) return "Password must be at least 10 characters.";
  // bcrypt only reads the first 72 bytes, so longer passwords would be silently cut off.
  if (Buffer.byteLength(password, "utf8") > 72) return "Password must be 72 bytes or fewer.";
  return null;
}
