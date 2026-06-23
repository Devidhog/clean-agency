import { sql } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { notifyNewBooking } from '../lib/notify.js';
import { waitUntil } from '@vercel/functions';

export default async function handler(req, res) {

if (req.method === 'POST') {

    const booking = req.body || {};

    if (
        !booking.name ||
        !booking.phone ||
        !booking.address ||
        !booking.date ||
        !booking.time ||
        !booking.service
    ) {
        return res.status(400).json({
            error: 'Missing required fields'
        });
    }

    const allowedServices = [
    'standard',
    'deep-cleaning',
    'renovation',
    'upholstery'
    ];

    if (!allowedServices.includes(booking.service)) {

        return res.status(400).json({
            error: 'Invalid service'
        });
    }

    const allowedSizes = [
    'studio',
    '1-bedroom',
    '2-bedroom',
    '3-bedroom',
    '4-bedroom'
    ];

    if (
    booking.service === 'upholstery' &&
    booking.size !== null
    ) {
        return res.status(400).json({
            error: 'Upholstery bookings cannot have property size'
        });
    }

    if (
    booking.service !== 'upholstery' &&
    !allowedSizes.includes(booking.size)
    ) {
        return res.status(400).json({
            error: 'Invalid property size'
        });
    }

    if (booking.service === 'upholstery') {

    const totalItems =
        Object.values(
            booking.upholsteryItems || {}
        )
        .reduce(
            (sum, qty) => sum + Number(qty || 0),
            0
        );

    if (totalItems < 1) {

        return res.status(400).json({
            error: 'At least one upholstery item required'
        });
    }
}

    if (booking.mapLink && booking.mapLink.trim()) {

        const link = booking.mapLink.trim();

        const allowed =
            /^https?:\/\/(www\.)?(maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

        if (!allowed.test(link)) {
            return res.status(400).json({
                error: 'Map link must be from Google Maps'
            });
        }

        if (link.length > 500) {
            return res.status(400).json({
                error: 'Map link too long'
            });
        }
    }

    const existingBooking = await sql`
        SELECT id
        FROM bookings
        WHERE booking_date = ${booking.date}
        AND booking_time = ${booking.time}
        AND status != 'cancelled'
        LIMIT 1
    `;

    if (existingBooking.length > 0) {
        return res.status(409).json({
            error: 'Time slot already booked'
        });
    }

    const blockedSlot = await sql`
        SELECT id
        FROM blocked_slots
        WHERE slot_date = ${booking.date}
        AND slot_time = ${booking.time}
        LIMIT 1
    `;

    if (blockedSlot.length > 0) {
        return res.status(409).json({
            error: 'Time slot is blocked'
        });
    }

    let promo = null;

    if (booking.promo) {
    
        const promoRows = await sql`
            SELECT
                code,
                discount_type,
                discount_value,
                max_uses,
                used
            FROM promo_codes
            WHERE code = ${booking.promo.toUpperCase()}
            AND active = TRUE
            LIMIT 1
        `;
    
        promo = promoRows[0];
    
        if (!promo) {
        
            return res.status(400).json({
                error: 'Invalid promo code'
            });
        }
    
        if (
            promo.max_uses > 0 &&
            promo.used >= promo.max_uses
        ) {
        
            return res.status(400).json({
                error: 'Promo code expired'
            });
        }
    }

    const bookingResult = await sql`
        INSERT INTO bookings (
            name,
            phone,
            address,
            map_link,
            service,
            property_size,
            booking_date,
            booking_time,
            notes,
            extras,
            upholstery_items,
            promo_code,
            base_price,
            extras_price,
            discount,
            total
        )
        VALUES (
            ${booking.name},
            ${booking.phone},
            ${booking.address},
            ${booking.mapLink || null},
            ${booking.service},
            ${booking.size || null},
            ${booking.date},
            ${booking.time},
            ${booking.notes || null},
            ${JSON.stringify(booking.extras || {})}::jsonb,
            ${JSON.stringify(booking.upholsteryItems || {})}::jsonb,
            ${booking.promo || null},
            ${booking.basePrice},
            ${booking.extrasPrice || 0},
            ${booking.discount || 0},
            ${booking.total}
        )
        RETURNING *
    `;

    const savedBooking = bookingResult[0];

    if (promo) {
        await sql`
            UPDATE promo_codes
            SET used = used + 1
            WHERE code = ${promo.code}
        `;
    }

    waitUntil(
        notifyNewBooking(savedBooking)
            .catch(error =>
                console.error('Notify failed:', error)
            )
    );

    return res.status(201).json({
        ok: true,
        booking: savedBooking
    });
}

const admin = requireAdmin(req, res);

if (!admin) return;

if (req.method === 'GET') {

    const bookingRows = await sql`
        SELECT *
        FROM bookings
        ORDER BY created_at DESC
        LIMIT 200
    `;

    return res.status(200).json({
        bookings: bookingRows
    });
}

if (req.method === 'PATCH') {

    const {
        id,
        status,
        expectedStatus
    } = req.body || {};

    const allowedStatuses = ['new', 'confirmed','done', 'cancelled'];

    if (!allowedStatuses.includes(status)) {

        return res.status(400).json({
            error: 'Invalid status'
        });
    }

    if (expectedStatus) {

        const currentBooking = await sql`
            SELECT status, name
            FROM bookings
            WHERE id = ${id}
            LIMIT 1
        `;

        if (!currentBooking.length) {
            return res.status(404).json({
                error: 'Booking not found'
            });
        }

        if (currentBooking[0].status !== expectedStatus) {
            return res.status(409).json({
                error: 'Status changed by another admin',
                currentStatus: currentBooking[0].status,
                bookingName: currentBooking[0].name
            });
        }
    }

    await sql`
        UPDATE bookings
        SET status = ${status}
        WHERE id = ${id}
    `;

    return res.status(200).json({
        ok: true
    });
}

if (req.method === 'DELETE') {

    const {
        id,
        expectedStatus
    } = req.body || {};

    if (!id) {
        return res.status(400).json({
            error: 'id required'
        });
    }

    if (expectedStatus) {

        const currentBooking = await sql`
            SELECT status, name
            FROM bookings
            WHERE id = ${id}
            LIMIT 1
        `;

        if (!currentBooking.length) {
            return res.status(404).json({
                error: 'Already deleted'
            });
        }

        if (currentBooking[0].status !== expectedStatus) {
            return res.status(409).json({
                error: 'Status changed by another admin',
                currentStatus: currentBooking[0].status,
                bookingName: currentBooking[0].name
            });
        }
    }

    await sql`
        DELETE FROM bookings
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
