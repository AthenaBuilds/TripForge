import bcrypt from 'bcrypt';
import type { LoginInput, SignupInput } from '@tripforge/shared';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/db.js';
import { AppError, unauthenticated } from '../lib/errors.js';

const BCRYPT_COST = 12;

// Compared against when the email is unknown, so a login takes the same time
// whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('tripforge-dummy-password', BCRYPT_COST);

const invalidCredentials = () =>
  new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect');

export async function signup(input: SignupInput) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  try {
    return await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) throw invalidCredentials();
  return user;
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // The token is valid but the account is gone: treat as logged out.
  if (!user) throw unauthenticated();
  return user;
}
