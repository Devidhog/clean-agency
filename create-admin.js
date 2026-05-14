import { sql } from './lib/db.js';
import { hashPassword } from './lib/auth.js';
import 'dotenv/config';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD_PLAIN;

if (!email || !password) {
    console.error('❌ ADMIN_EMAIL or ADMIN_PASSWORD_PLAIN not set in .env.local');
    process.exit(1);
}

const hash = await hashPassword(password);

await sql`
  INSERT INTO admins (email, password_hash, name, role)
  VALUES (${email}, ${hash}, 'Owner', 'admin')
  ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}
`;

console.log(`✅ Admin created/updated: ${email}`);
process.exit(0);