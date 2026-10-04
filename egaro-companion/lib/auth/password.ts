// Password hashing with bcrypt (bcryptjs = pure JavaScript, works everywhere including Vercel).
// A hash is one-way: we can check a password against it, but never get the password back.
import bcrypt from "bcryptjs";

const COST = 12; // higher = slower to brute-force. 12 is a sensible default.

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Used when the email does not exist, so a login for an unknown email takes about as
// long as a real one (stops attackers from discovering which emails are registered by timing).
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);
