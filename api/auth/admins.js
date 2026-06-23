import { getAdminFromRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
    const admin = getAdminFromRequest(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
    return res.status(200).json({ admin });
}