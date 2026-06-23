import { sql } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {

const admin = requireAdmin(req, res);

if (!admin) {
    return;
}

if (req.method === 'GET') {

    const promoRows = await sql`
        SELECT *
        FROM promo_codes
        ORDER BY created_at DESC
    `;

    return res.status(200).json({
        promos: promoRows
    });
}

if (req.method === 'POST') {

    const {
        code,
        type,
        value,
        maxUses
    } = req.body || {};

    if (
        !code ||
        !type ||
        !value
    ) {
        return res.status(400).json({
            error: 'code, type, value required'
        });
    }

    const allowedTypes = [
        'percent',
        'fixed'
    ];

    if (
        !allowedTypes.includes(type)
    ) {
        return res.status(400).json({
            error: 'Invalid promo type'
        });
    }

    if (
        Number(value) <= 0
    ) {
        return res.status(400).json({
            error: 'Discount must be greater than 0'
        });
    }

    if (
        type === 'percent' &&
        Number(value) > 100
    ) {
        return res.status(400).json({
            error: 'Percentage cannot exceed 100'
        });
    }

    try {

        const promoResult = await sql`
            INSERT INTO promo_codes (
                code,
                discount_type,
                discount_value,
                max_uses,
                used
            )
            VALUES (
                ${code.toUpperCase()},
                ${type},
                ${value},
                ${maxUses || 0},
                0
            )
            RETURNING *
        `;

        return res.status(201).json({
            ok: true,
            promo: promoResult[0]
        });

    } catch (error) {

        const errorMessage =
            String(error.message).toLowerCase();

        if (
            errorMessage.includes('duplicate') ||
            errorMessage.includes('unique')
        ) {
            return res.status(409).json({
                error: 'Code already exists'
            });
        }

        throw error;
    }
}

if (req.method === 'DELETE') {

    const { id } = req.body || {};

    if (!id) {
        return res.status(400).json({
            error: 'id required'
        });
    }

    await sql`
        DELETE FROM promo_codes
        WHERE id = ${id}
    `;

    return res.status(200).json({
        ok: true
    });
}

return res.status(405).json({
    error: 'Method not allowed'
});

}
