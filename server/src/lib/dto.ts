import type { User } from '@tripforge/shared';

type UserRow = { id: string; name: string; email: string; createdAt: Date };

export function toUserDto(user: UserRow): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
