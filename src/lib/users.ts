/**
 * User storage — reads/writes BASE_DATA_ROOT/users.json.
 * Passwords are stored as bcrypt hashes; never plain-text.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export const BASE_DATA_ROOT =
  process.env.DATA_DIR ?? path.resolve(process.cwd(), "personal", "data");

const USERS_FILE = path.join(BASE_DATA_ROOT, "users.json");

export interface AppUser {
  id: string; // slug used as folder name, e.g. "tanish"
  name: string; // display name
  email: string; // used as NextAuth login identifier
  passwordHash: string;
  createdAt: string;
}

function readUsers(): AppUser[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) as AppUser[];
}

function writeUsers(users: AppUser[]): void {
  fs.mkdirSync(BASE_DATA_ROOT, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export function findUserByEmail(email: string): AppUser | undefined {
  return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): AppUser | undefined {
  return readUsers().find((u) => u.id === id);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Creates a new user. Throws if email is already taken. */
export async function createUser(opts: {
  id: string;
  name: string;
  email: string;
  password: string;
}): Promise<AppUser> {
  const users = readUsers();
  if (users.find((u) => u.email.toLowerCase() === opts.email.toLowerCase())) {
    throw new Error(`Email ${opts.email} is already registered.`);
  }
  if (users.find((u) => u.id === opts.id)) {
    throw new Error(`ID "${opts.id}" is already taken.`);
  }
  const passwordHash = await bcrypt.hash(opts.password, 12);
  const user: AppUser = {
    id: opts.id,
    name: opts.name,
    email: opts.email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return user;
}
