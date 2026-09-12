import { prisma } from "../../lib/prisma.js";
import { hashPassword, comparePassword } from "../../lib/password.js";

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function toPublicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
}

export async function registerUser({ email, password, displayName }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  return toPublicUser(user);
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same message whether the email doesn't exist or the password is wrong —
  // otherwise the response itself tells an attacker which emails are registered.
  const invalidCredentials = () => new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  if (!user) {
    throw invalidCredentials();
  }

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    throw invalidCredentials();
  }

  return toPublicUser(user);
}

export { toPublicUser };
