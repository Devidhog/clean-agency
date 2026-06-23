import { sql } from '../lib/db.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code required' });

    const promoRows = await sql`
    SELECT code, discount_type, discount_value, max_uses, used 
    FROM promo_codes 
    WHERE code = ${code.toUpperCase()} AND active = TRUE
    LIMIT 1
  `;

    const promoCode = promoRows[0];
    if (!promoCode) return res.status(404).json({ error: 'Invalid code' });

    if (promoCode.max_uses > 0 && promoCode.used >= promoCode.max_uses) {
        return res.status(410).json({ error: 'Code expired' });
    }

    return res.status(200).json({
        ok: true,
        promo: {
            code: promoCode.code,
            type: promoCode.discount_type,
            value: promoCode.discount_value
        }
    });
}