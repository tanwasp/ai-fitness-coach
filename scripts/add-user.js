#!/usr/bin/env node
/**
 * Add a user to the fitness dashboard.
 *
 * Usage:
 *   node scripts/add-user.js --id tanish --name "Tanish" --email "you@example.com" --password "secret"
 *
 * Optional:
 *   DATA_DIR=/path/to/data node scripts/add-user.js ...
 *
 * The script writes to <DATA_DIR>/users.json (created if absent).
 */

const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// -- resolve DATA_DIR ---------------------------------------------------------
const DATA_DIR =
  process.env.DATA_DIR ?? path.resolve(__dirname, "..", "personal", "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");

// -- parse args ---------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const id = getArg("--id") || crypto.randomUUID().split("-")[0];
const name = getArg("--name");
const email = getArg("--email");
const password = getArg("--password");

if (!name || !email || !password) {
  console.error(
    "Usage: node scripts/add-user.js --name \"Name\" --email email@example.com --password secret [--id custom-id]"
  );
  process.exit(1);
}

// -- load existing users ------------------------------------------------------
fs.mkdirSync(DATA_DIR, { recursive: true });

let users = [];
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    console.warn("Warning: could not parse existing users.json — starting fresh.");
    users = [];
  }
}

// -- check for duplicates -----------------------------------------------------
if (users.some((u) => u.email === email)) {
  console.error(`Error: a user with email "${email}" already exists.`);
  process.exit(1);
}
if (users.some((u) => u.id === id)) {
  console.error(`Error: a user with id "${id}" already exists. Choose a different --id.`);
  process.exit(1);
}

// -- hash password & append ---------------------------------------------------
const passwordHash = bcrypt.hashSync(password, 12);
const newUser = {
  id,
  name,
  email,
  passwordHash,
  createdAt: new Date().toISOString(),
};

users.push(newUser);
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

// -- create user data directory -----------------------------------------------
const userDir = path.join(DATA_DIR, id);
fs.mkdirSync(path.join(userDir, "coach"), { recursive: true });
console.log(`✓ Created data directory: ${userDir}`);

console.log(`
✓ User created successfully!
  ID:    ${id}
  Name:  ${name}
  Email: ${email}

They can now log in at /login.
`);
