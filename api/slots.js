import { sql } from '../lib/db.js';
import { requireAdmin, getAdminFromRequest } from '../lib/auth.js';

export default async function handler(req, res) {

    if (req.method === 'GET') {

        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                error: 'date required'
            });
        }

        const bookedSlots = await sql`
            SELECT booking_time
            FROM bookings
            WHERE booking_date = ${date}
            AND status != 'cancelled'
        `;

        const blockedSlots = await sql`
            SELECT slot_time
            FROM blocked_slots
            WHERE slot_date = ${date}
        `;

        return res.status(200).json({
            booked: bookedSlots.map(
                booking => booking.booking_time
            ),

            blocked: blockedSlots.map(
                slot => slot.slot_time
            )
        });
    }

    const admin = requireAdmin(req, res);

    if (!admin) return;

    if (req.method === 'POST') {

        const {
            date,
            time,
            action
        } = req.body || {};

        if (!date || !time || !action) {
            return res.status(400).json({
                error: 'date, time, action required'
            });
        }

        if (action === 'block') {

            await sql`
                INSERT INTO blocked_slots (
                    slot_date,
                    slot_time
                )
                VALUES (
                    ${date},
                    ${time}
                )
                ON CONFLICT (
                    slot_date,
                    slot_time
                )
                DO NOTHING
            `;

        } else if (action === 'unblock') {

            await sql`
                DELETE FROM blocked_slots
                WHERE slot_date = ${date}
                AND slot_time = ${time}
            `;

        } else {

            return res.status(400).json({
                error: 'action must be block or unblock'
            });
        }

        return res.status(200).json({
            ok: true
        });
    }

    return res.status(405).json({
        error: 'Method not allowed'
    });
}