import { sql } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { notifyNewBooking } from '../lib/notify.js';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const b = req.body || {};

        if (!b.name || !b.phone || !b.addr || !b.date || !b.time || !b.service) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (b.mapLink && b.mapLink.trim()) {
            const link = b.mapLink.trim();
            const allowed = /^https?:\/\/(www\.)?(maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
            if (!allowed.test(link)) {
                return res.status(400).json({ error: 'Map link must be from Google Maps' });
            }
            if (link.length > 500) {
                return res.status(400).json({ error: 'Map link too long' });
            }
        }

        const existing = await sql`
      SELECT id FROM bookings 
      WHERE booking_date = ${b.date} AND booking_time = ${b.time} AND status != 'cancelled'
      LIMIT 1
    `;
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Time slot already booked' });
        }

        const blocked = await sql`
      SELECT id FROM blocked_slots 
      WHERE slot_date = ${b.date} AND slot_time = ${b.time}
      LIMIT 1
    `;
        if (blocked.length > 0) {
            return res.status(409).json({ error: 'Time slot is blocked' });
        }

        if (b.promo) {
            await sql`UPDATE promo_codes SET used = used + 1 WHERE code = ${b.promo}`;
        }

        const result = await sql`
      INSERT INTO bookings (
        name, phone, addr, map_link, service, size,
        booking_date, booking_time, notes, extras, uph_items,
        promo_code, base_price, extras_price, discount, total
      ) VALUES (
        ${b.name}, ${b.phone}, ${b.addr}, ${b.mapLink || null},
        ${b.service}, ${b.size || null},
        ${b.date}, ${b.time}, ${b.notes || null},
        ${JSON.stringify(b.extras || {})}::jsonb,
        ${JSON.stringify(b.uphItems || {})}::jsonb,
        ${b.promo || null}, ${b.basePrice}, ${b.extrasPrice || 0},
        ${b.discount || 0}, ${b.total}
      )
      RETURNING *
    `;

        const booking = result[0];

        notifyNewBooking(booking).catch(e => console.error('Notify failed:', e));

        return res.status(201).json({ ok: true, booking });
    }

    const admin = requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 200`;
        return res.status(200).json({ bookings: rows });
    }

    if (req.method === 'PATCH') {
        const { id, status } = req.body || {};
        if (!id || !status) return res.status(400).json({ error: 'id and status required' });
        await sql`UPDATE bookings SET status = ${status} WHERE id = ${id}`;
        return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        await sql`DELETE FROM bookings WHERE id = ${id}`;
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}