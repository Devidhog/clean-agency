import { sql } from '../../lib/db.js';
import { verifyPassword, createToken, setAuthCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const adminRows = await sql`SELECT * FROM admins WHERE email = ${email.toLowerCase()} LIMIT 1`;
    const admin = adminRows[0];

    if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({ id: admin.id, email: admin.email, role: admin.role });
    setAuthCookie(res, token);

    return res.status(200).json({
        ok: true,
        admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    });
}