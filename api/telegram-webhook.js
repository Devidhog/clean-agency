import { sql } from '../lib/db.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const ALLOWED_IDS =
    (process.env.TELEGRAM_ALLOWED_IDS || '')
        .split(',')
        .map(telegramId => telegramId.trim())
        .filter(Boolean);

const SECRET =
    process.env.TELEGRAM_WEBHOOK_SECRET;

const SERVICE_NAMES = {
    standard: 'Standard cleaning',
    'deep-cleaning': 'Deep cleaning',
    renovation: 'After renovation',
    upholstery: 'Upholstery cleaning'
};

const SIZE_NAMES = {
    studio: 'Studio',
    '1-bedroom': '1-bedroom',
    '2-bedroom': '2-bedroom',
    '3-bedroom': '3-bedroom',
    '4-bedroom': '4-bedroom'
};

const STATUS_NAMES = {
    new: '🆕 New',
    confirmed: '✅ Confirmed',
    done: '✓✓ Done',
    cancelled: '❌ Cancelled'
};

async function callTelegramApi(
    method,
    requestBody
) {

    const response =
        await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify(
                    requestBody
                )
            }
        );

    return response.json();
}

function formatDate(
    dateValue,
    time
) {

    const date =
        new Date(dateValue);

    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
    ];

    return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${time}`;
}

function bookingText(booking) {

    const dateString =
        formatDate(
            booking.booking_date,
            booking.booking_time
        );

    const serviceName =
        SERVICE_NAMES[
            booking.service
        ] || booking.service;

    const propertySize =
        booking.property_size &&
        booking.property_size !== '—'

            ? `, ${
                SIZE_NAMES[
                    booking.property_size
                ] || booking.property_size
            }`

            : '';

    const address =
        booking.map_link

            ? `<a href="${booking.map_link}">${booking.address}</a>`

            : booking.address;

    let extrasString = '';

    if (
        booking.service !== 'upholstery' &&
        booking.extras
    ) {

        const selectedExtras =
            Object.entries(
                booking.extras || {}
            )
            .filter(
                ([itemId, quantity]) =>
                    quantity > 0
            )
            .map(
                ([itemId, quantity]) =>
                    `${itemId} ×${quantity}`
            );

        if (
            selectedExtras.length
        ) {
            extrasString =
                ` + ${selectedExtras.join(', ')}`;
        }
    }

    if (
        booking.service === 'upholstery' &&
        booking.upholstery_items
    ) {

        const selectedUpholsteryItems =
            Object.entries(
                booking.upholstery_items || {}
            )
            .filter(
                ([itemId, quantity]) =>
                    quantity > 0
            )
            .map(
                ([itemId, quantity]) =>
                    `${itemId} ×${quantity}`
            );

        if (
            selectedUpholsteryItems.length
        ) {
            extrasString =
                `: ${selectedUpholsteryItems.join(', ')}`;
        }
    }

    return `🧹 <b>Booking #${booking.id}</b> · ${STATUS_NAMES[booking.status] || booking.status}

    <b>Name:</b> ${booking.name}
    <b>Phone:</b> <a href="tel:${booking.phone}">${booking.phone}</a>
    <b>Address:</b> ${address}
    <b>Service:</b> ${serviceName}${propertySize}${extrasString}
    <b>Date:</b> ${dateString}
    ${booking.notes ? `<b>Notes:</b> ${booking.notes}\n` : ''}
    ${booking.promo_code ? `<b>Promo:</b> ${booking.promo_code}\n` : ''}
    <b>Price:</b> €${booking.total}`;
}

function bookingKeyboard(
    booking
) {

    const keyboardRows = [];

    if (
        booking.status === 'new'
    ) {

        keyboardRows.push([
            {
                text: '✅ Confirm',
                callback_data:
                    `confirm:${booking.id}`
            },
            {
                text: '❌ Cancel',
                callback_data:
                    `cancel:${booking.id}`
            }
        ]);
    }

    if (
        booking.status === 'confirmed'
    ) {

        keyboardRows.push([
            {
                text: '✓✓ Mark Done',
                callback_data:
                    `done:${booking.id}`
            },
            {
                text: '❌ Cancel',
                callback_data:
                    `cancel:${booking.id}`
            }
        ]);
    }

    if (
        booking.status === 'done' ||
        booking.status === 'cancelled'
    ) {

        keyboardRows.push([
            {
                text: '↩️ Reopen',
                callback_data:
                    `reopen:${booking.id}`
            }
        ]);
    }

    keyboardRows.push([
        {
            text: '🗑 Delete',
            callback_data:
                `delconfirm:${booking.id}`
        }
    ]);

    return {
        inline_keyboard:
            keyboardRows
    };
}

const MAIN_MENU = {
    keyboard: [
        [{ text: '🆕 Pending' }, { text: '📅 Today' }],
        [{ text: '📅 Tomorrow' }, { text: '📅 Week' }],
        [{ text: '🔍 Find' }, { text: '🏷 Promos' }],
        [{ text: '🚫 Block slot' }, { text: '📊 Stats' }],
        [{ text: '❓ Help' }]
    ],
    resize_keyboard: true,
    is_persistent: true
};

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res
            .status(405)
            .end();
    }

    if (SECRET) {
        const receivedSecret =
            req.headers[
                'x-telegram-bot-api-secret-token'
            ];

        if (receivedSecret !== SECRET) {
            return res
                .status(401)
                .end();
        }
    }

    const telegramUpdate = req.body || {};
    try {
        if (
            telegramUpdate.message) {
            await handleMessage(
                telegramUpdate.message
            );

        } else if (telegramUpdate.callback_query) {

            await handleCallback(telegramUpdate.callback_query
            );
        }

    } catch (error) {

        console.error('Webhook handler failed:', error
        );
    }

    return res.status(200).json({
        ok: true
    });
}

function isAllowed(userId) {

    return ALLOWED_IDS.includes(String(userId));
}

async function handleMessage(message) {
    const userId =
        message.from?.id;

    const chatId =
        message.chat?.id;

    const messageText = (message.text || '').trim();
    if (!isAllowed(userId)) {
        await callTelegramApi('sendMessage',
            {
                chat_id: chatId,
                text:
                    '⛔ You are not authorized to use this bot.'
            }
        );

        return;
    }

    if (messageText === '/start' || messageText === '/help' || messageText === '❓ Help') {
        await callTelegramApi('sendMessage',
            {
                chat_id: chatId,
                text: `👋 <b>clean.agency admin bot</b>

📅 <b>View bookings:</b>
- <b>Today</b> / <b>Tomorrow</b> / <b>Week</b>
- <b>Pending</b> — awaiting confirmation

🔍 <b>Find a booking:</b>
<code>/find Elena</code> — by name
<code>/find 357991</code> — by phone

🏷 <b>Manage promo codes:</b>
<code>/promos</code> — list all codes with usage
<code>/promo SUMMER25 25%</code> — create new, unlimited
<code>/promo VIP10 10 50</code> — €10 off, max 50 uses
<code>/delpromo SUMMER25</code> — delete by code

🚫 <b>Block a time slot:</b>
<code>/block 2026-05-20 14:00</code>
<code>/unblock 2026-05-20 14:00</code>

📊 <b>Stats</b> — month overview

Tip: press buttons under any booking notification to manage it directly.`,

                parse_mode: 'HTML',

                reply_markup:
                    MAIN_MENU
            }
        );

        return;
    }

    const buttonCommandMap = {

        '📅 Today':
            '/today',

        '📅 Tomorrow':
            '/tomorrow',

        '📅 Week':
            '/week',

        '🆕 Pending':
            '/pending',

        '📊 Stats':
            '/stats',

        '🔍 Find':
            '/find',

        '🏷 Promos':
            '/promos',

        '🚫 Block slot':
            '/block'
    };

    const command = buttonCommandMap[messageText] || messageText;
    if (
        command === '/today' || command === '/tomorrow' || command === '/week' ||
        command === '/pending') {
        await listBookings(chatId, command);
        return;
    }

    if (command === '/stats') {
        await sendStats(chatId);
        return;
    }

    if (command.startsWith('/find')) {
        const searchQuery =command.slice(5).trim();
        await findBookings(chatId, searchQuery);
        return;
    }

    if (command === '/promos') {
        await listPromos(chatId);
        return;
    }
    if (command.startsWith('/delpromo')) {
        const promoCode =command.slice(9).trim();
        await deletePromoByCode(chatId,promoCode);
        return;
    }

    if (command.startsWith('/promo')) {
        const promoArguments = command.slice(6).trim();
        await createPromo(chatId, promoArguments);
        return;
    }

    if (command.startsWith('/block') || command.startsWith('/unblock')) {
        const isBlockAction = command.startsWith('/block');
        const slotArguments = command.slice(isBlockAction ? 6 : 8).trim();
        await blockSlot(chatId, slotArguments, isBlockAction);
        return;
    }

    await callTelegramApi('sendMessage',{
            chat_id: chatId,
            text:
                '❓ Unknown command. Tap a button or send /help.',
            reply_markup:
                MAIN_MENU
        }
    );
}

async function listBookings(
    chatId,
    command
) {

    const today =
        new Date()
            .toISOString()
            .split('T')[0];

    const tomorrowDate =
        new Date();

    tomorrowDate.setDate(
        tomorrowDate.getDate() + 1
    );

    const tomorrowDateString =
        tomorrowDate
            .toISOString()
            .split('T')[0];

    const weekEndDate =
        new Date();

    weekEndDate.setDate(
        weekEndDate.getDate() + 7
    );

    const weekEndDateString =
        weekEndDate
            .toISOString()
            .split('T')[0];

    let bookingRows;
    let titleText;

    if (
        command === '/today'
    ) {

        bookingRows =
            await sql`
                SELECT *
                FROM bookings
                WHERE booking_date = ${today}
                AND status != 'cancelled'
                ORDER BY booking_time
            `;

        titleText =
            `📅 Today (${today})`;

    } else if (
        command === '/tomorrow'
    ) {

        bookingRows =
            await sql`
                SELECT *
                FROM bookings
                WHERE booking_date = ${tomorrowDateString}
                AND status != 'cancelled'
                ORDER BY booking_time
            `;

        titleText =
            `📅 Tomorrow (${tomorrowDateString})`;

    } else if (
        command === '/week'
    ) {

        bookingRows =
            await sql`
                SELECT *
                FROM bookings
                WHERE booking_date
                BETWEEN ${today}
                AND ${weekEndDateString}
                AND status != 'cancelled'
                ORDER BY booking_date, booking_time
            `;

        titleText =
            '📅 Next 7 days';

    } else {

        bookingRows =
            await sql`
                SELECT *
                FROM bookings
                WHERE status = 'new'
                ORDER BY booking_date, booking_time
                LIMIT 20
            `;

        titleText =
            '🆕 Pending bookings';
    }

    if (
        !bookingRows.length
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,
                text:
                    `${titleText}\n\n<i>No bookings.</i>`,
                parse_mode: 'HTML'
            }
        );

        return;
    }

    await callTelegramApi(
        'sendMessage',
        {
            chat_id: chatId,
            text:
                `${titleText}\n<i>${bookingRows.length} booking(s)</i>`,
            parse_mode: 'HTML'
        }
    );

    for (
        const booking
        of bookingRows
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    bookingText(
                        booking
                    ),

                parse_mode:
                    'HTML',

                reply_markup:
                    bookingKeyboard(
                        booking
                    ),

                disable_web_page_preview:
                    true
            }
        );
    }
}

async function sendStats(
    chatId
) {

    const currentDate =
        new Date();

    const firstDay =
        new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
        )
            .toISOString()
            .split('T')[0];

    const lastDay =
        new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
        )
            .toISOString()
            .split('T')[0];

    const statsRows =
        await sql`
            SELECT
                COUNT(*)::int as total,

                COUNT(*) FILTER (
                    WHERE status = 'new'
                )::int as new_cnt,

                COUNT(*) FILTER (
                    WHERE status = 'confirmed'
                )::int as confirmed_cnt,

                COUNT(*) FILTER (
                    WHERE status = 'done'
                )::int as done_cnt,

                COUNT(*) FILTER (
                    WHERE status = 'cancelled'
                )::int as cancelled_cnt,

                COALESCE(
                    SUM(total)
                    FILTER (
                        WHERE status != 'cancelled'
                    ),
                    0
                )::int as revenue

            FROM bookings

            WHERE booking_date
            BETWEEN ${firstDay}
            AND ${lastDay}
        `;

    const stats =
        statsRows[0];

    const monthName =
        currentDate.toLocaleString(
            'en',
            {
                month: 'long',
                year: 'numeric'
            }
        );

    await callTelegramApi(
        'sendMessage',
        {
            chat_id: chatId,

            text: `📊 <b>Stats for ${monthName}</b>

<b>Total bookings:</b> ${stats.total}
🆕 New: ${stats.new_cnt}
✅ Confirmed: ${stats.confirmed_cnt}
✓✓ Done: ${stats.done_cnt}
❌ Cancelled: ${stats.cancelled_cnt}

💰 <b>Revenue (excl. cancelled):</b> €${stats.revenue}`,

            parse_mode: 'HTML'
        }
    );
}

async function findBookings(
    chatId,
    searchQuery
) {

    if (!searchQuery) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text: `🔍 <b>Find a booking</b>

Usage:
<code>/find Elena</code> — search by name
<code>/find 357991</code> — search by phone`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const searchPattern =
        '%' +
        searchQuery.toLowerCase() +
        '%';

    const bookingRows =
        await sql`
            SELECT *
            FROM bookings
            WHERE
                LOWER(name) LIKE ${searchPattern}
                OR LOWER(phone) LIKE ${searchPattern}
            ORDER BY
                booking_date DESC,
                booking_time DESC
            LIMIT 20
        `;

    if (!bookingRows.length) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    `🔍 No bookings found for: <i>${searchQuery}</i>`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    await callTelegramApi(
        'sendMessage',
        {
            chat_id: chatId,

            text:
                `🔍 <b>Found ${bookingRows.length} booking(s)</b> for: <i>${searchQuery}</i>`,

            parse_mode: 'HTML'
        }
    );

    for (
        const booking
        of bookingRows
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    bookingText(
                        booking
                    ),

                parse_mode:
                    'HTML',

                reply_markup:
                    bookingKeyboard(
                        booking
                    ),

                disable_web_page_preview:
                    true
            }
        );
    }
}

async function createPromo(
    chatId,
    promoArguments
) {

    if (!promoArguments) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text: `🏷 <b>Create a promo code</b>

<b>Usage:</b>
<code>/promo CODE VALUE[%] [MAX_USES]</code>

📌 <b>Parameters:</b>

- <b>CODE</b> — name customers will type (e.g. SUMMER25)

- <b>VALUE</b> — discount: 25% (percent) or 10 (euros)

- <b>MAX_USES</b> — optional, how many times the code can be used. Skip or put 0 for unlimited.

<b>Examples:</b>

<code>/promo SUMMER25 25%</code>
→ 25% off, unlimited uses

<code>/promo SUMMER25 25% 100</code>
→ 25% off, first 100 customers only

<code>/promo VIP10 10 50</code>
→ €10 off, max 50 uses

<code>/promo WELCOME 5%</code>
→ 5% off, unlimited

After 1st value comes the discount.
After 2nd value (optional) comes the uses limit.`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const promoParts =
        promoArguments.split(/\s+/);

    if (
        promoParts.length < 2
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '❌ Not enough arguments. Use <code>/promo</code> for help.',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const promoCode =
        promoParts[0]
            .toUpperCase();

    const discountValueRaw =
        promoParts[1];

    const maxUses =
        promoParts[2]
            ? parseInt(
                promoParts[2]
            )
            : 0;

    let discountType;
    let discountValue;

    if (
        discountValueRaw.endsWith(
            '%'
        )
    ) {

        discountType =
            'percent';

        discountValue =
            parseInt(
                discountValueRaw.slice(
                    0,
                    -1
                )
            );

    } else {

        discountType =
            'fixed';

        discountValue =
            parseInt(
                discountValueRaw
            );
    }

    if (
        !promoCode ||
        !discountValue ||
        isNaN(discountValue) ||
        discountValue <= 0
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '❌ Invalid arguments. Code and positive value required.',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    if (
        discountType ===
            'percent' &&
        discountValue > 100
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '❌ Percentage discount cannot exceed 100%.',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    try {

        await sql`
            INSERT INTO promo_codes (
                code,
                discount_type,
                discount_value,
                max_uses,
                used
            )
            VALUES (
                ${promoCode},
                ${discountType},
                ${discountValue},
                ${maxUses},
                0
            )
        `;

        const discountDisplay =
            discountType ===
            'percent'
                ? `${discountValue}%`
                : `€${discountValue}`;

        const activationDisplay =
            maxUses === 0
                ? '∞ unlimited activations'
                : `${maxUses} activations`;

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text: `✅ <b>Promo code created!</b>

<b>Code:</b> <code>${promoCode}</code>
<b>Discount:</b> ${discountDisplay} off
<b>Activations:</b> ${activationDisplay}

Share it with customers — they enter it in the booking form on the website.`,

                parse_mode: 'HTML'
            }
        );

    } catch (error) {

       if (String(error.message).toLowerCase().includes('duplicate') || String(error.message).toLowerCase().includes('unique'))
        {

            await callTelegramApi(
                'sendMessage',
                {
                    chat_id: chatId,

                    text:
                        `❌ Code <code>${promoCode}</code> already exists. Use a different one.`,

                    parse_mode: 'HTML'
                }
            );

        } else {

            await callTelegramApi(
                'sendMessage',
                {
                    chat_id: chatId,

                    text:
                        '❌ Failed to create promo code: ' +
                        error.message
                }
            );
        }
    }
}

async function listPromos(chatId) {

    const promoRows =
        await sql`
            SELECT *
            FROM promo_codes
            ORDER BY created_at DESC
        `;

    if (!promoRows.length) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '🏷 <b>No promo codes yet.</b>\n\nUse <code>/promo CODE VALUE [MAX]</code> to create one.',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    await callTelegramApi(
        'sendMessage',
        {
            chat_id: chatId,

            text:
                `🏷 <b>Promo codes (${promoRows.length})</b>`,

            parse_mode: 'HTML'
        }
    );

    for (
        const promoCode
        of promoRows
    ) {

        const discountDisplay =
            promoCode.discount_type === 'percent'
                ? `${promoCode.discount_value}%`
                : `€${promoCode.discount_value}`;

        const usageDisplay =
            promoCode.max_uses === 0
                ? '∞ unlimited'
                : `${promoCode.used} / ${promoCode.max_uses}`;

        const isExpired =
            promoCode.max_uses > 0 &&
            promoCode.used >= promoCode.max_uses;

        const promoStatus =
            isExpired
                ? ' · ⛔ EXPIRED'
                : '';

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text: `<code>${promoCode.code}</code>${promoStatus}

<b>Discount:</b> ${discountDisplay} off
<b>Used:</b> ${usageDisplay}`,

                parse_mode: 'HTML',

                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '🗑 Delete',
                                callback_data:
                                    `delpromo:${promoCode.id}`
                            }
                        ]
                    ]
                }
            }
        );
    }
}

async function deletePromoByCode(
    chatId,
    promoCode
) {

    if (!promoCode) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text: `🗑 <b>Delete a promo code</b>

Usage:
<code>/delpromo CODE</code>

Example:
<code>/delpromo SUMMER25</code>

Or use <code>/promos</code> to see all codes with Delete buttons.`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const normalizedPromoCode =
        promoCode.toUpperCase();

    const deletedPromoResult =
        await sql`
            DELETE FROM promo_codes
            WHERE code = ${normalizedPromoCode}
            RETURNING id
        `;

    if (
        !deletedPromoResult.length
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    `❌ Promo code <code>${normalizedPromoCode}</code> not found.`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    await callTelegramApi(
        'sendMessage',
        {
            chat_id: chatId,

            text:
                `✅ Promo code <code>${normalizedPromoCode}</code> deleted.`,

            parse_mode: 'HTML'
        }
    );
}

async function blockSlot(
    chatId,
    slotArguments,
    isBlockAction
) {

    if (!slotArguments) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text: `🚫 <b>Block / Unblock a time slot</b>

<b>Usage:</b>
<code>/block YYYY-MM-DD HH:MM</code> — block a slot
<code>/unblock YYYY-MM-DD HH:MM</code> — unblock

<b>Examples:</b>
<code>/block 2026-05-20 14:00</code>
<code>/unblock 2026-05-20 14:00</code>

Available times: 08:00 — 19:00 (hourly)`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const slotParts =
        slotArguments.split(/\s+/);

    if (
        slotParts.length < 2
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '❌ Need both date and time. Example: <code>/block 2026-05-20 14:00</code>',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const slotDate =
        slotParts[0];

    const slotTime =
        slotParts[1];

    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(slotDate)
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '❌ Date must be in YYYY-MM-DD format. Example: 2026-05-20',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    if (
        !/^\d{2}:\d{2}$/
            .test(slotTime)
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    '❌ Time must be in HH:MM format. Example: 14:00',

                parse_mode: 'HTML'
            }
        );

        return;
    }

    const existingBooking =
        await sql`
            SELECT id
            FROM bookings
            WHERE booking_date = ${slotDate}
            AND booking_time = ${slotTime}
            AND status != 'cancelled'
            LIMIT 1
        `;

    if (
        existingBooking.length > 0 &&
        isBlockAction
    ) {

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    `⚠️ This slot already has a booking (#${existingBooking[0].id}). Cancel or delete it first.`,

                parse_mode: 'HTML'
            }
        );

        return;
    }

    if (isBlockAction) {

        await sql`
            INSERT INTO blocked_slots (
                slot_date,
                slot_time
            )
            VALUES (
                ${slotDate},
                ${slotTime}
            )
            ON CONFLICT (
                slot_date,
                slot_time
            )
            DO NOTHING
        `;

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    `🚫 Slot <b>${slotDate} ${slotTime}</b> blocked. Customers won't be able to book it.`,

                parse_mode: 'HTML'
            }
        );

    } else {

        const unblockResult =
            await sql`
                DELETE FROM blocked_slots
                WHERE slot_date = ${slotDate}
                AND slot_time = ${slotTime}
            `;

        await callTelegramApi(
            'sendMessage',
            {
                chat_id: chatId,

                text:
                    `✅ Slot <b>${slotDate} ${slotTime}</b> unblocked. It's now available for booking.`,

                parse_mode: 'HTML'
            }
        );
    }
}

async function handleCallback(
    callbackQuery
) {

    const userId =
        callbackQuery.from?.id;

    const chatId =
        callbackQuery.message?.chat?.id;

    const messageId =
        callbackQuery.message?.message_id;

    const callbackData =
        callbackQuery.data || '';

    if (!isAllowed(userId)) {

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id,

                text:
                    '⛔ Not authorized',

                show_alert: true
            }
        );

        return;
    }

    const [
        callbackAction,
        bookingIdString,
        callbackSubAction
    ] =
        callbackData.split(':');

    const bookingId =
        parseInt(
            bookingIdString
        );

    if (!bookingId) {
        return;
    }

    if (
        callbackAction ===
        'delpromo'
    ) {

        const promoRows =
            await sql`
                SELECT code
                FROM promo_codes
                WHERE id = ${bookingId}
                LIMIT 1
            `;

        if (
            !promoRows.length
        ) {

            await callTelegramApi(
                'answerCallbackQuery',
                {
                    callback_query_id:
                        callbackQuery.id,

                    text:
                        'Promo not found'
                }
            );

            return;
        }

        const promoCode =
            promoRows[0].code;

        await sql`
            DELETE FROM promo_codes
            WHERE id = ${bookingId}
        `;

        await callTelegramApi(
            'editMessageText',
            {
                chat_id:
                    chatId,

                message_id:
                    messageId,

                text:
                    `🗑 <b>Promo code ${promoCode} deleted</b>`,

                parse_mode:
                    'HTML'
            }
        );

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id,

                text:
                    '🗑 Deleted'
            }
        );

        return;
    }

    if (
        callbackAction ===
        'delconfirm'
    ) {

        await callTelegramApi(
            'editMessageReplyMarkup',
            {
                chat_id:
                    chatId,

                message_id:
                    messageId,

                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text:
                                    '⚠️ Yes, delete',

                                callback_data:
                                    `del:${bookingId}`
                            },
                            {
                                text:
                                    '↩️ Keep',

                                callback_data:
                                    `back:${bookingId}`
                            }
                        ]
                    ]
                }
            }
        );

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id,

                text:
                    'Confirm deletion?'
            }
        );

        return;
    }

    if (
        callbackAction ===
        'del'
    ) {

        await sql`
            DELETE FROM bookings
            WHERE id = ${bookingId}
        `;

        await callTelegramApi(
            'editMessageText',
            {
                chat_id:
                    chatId,

                message_id:
                    messageId,

                text:
                    `🗑 <b>Booking #${bookingId} deleted</b>`,

                parse_mode:
                    'HTML'
            }
        );

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id,

                text:
                    '🗑 Deleted'
            }
        );

        return;
    }

    if (
        callbackAction ===
        'back'
    ) {

        const bookingRows =
            await sql`
                SELECT *
                FROM bookings
                WHERE id = ${bookingId}
                LIMIT 1
            `;

        const booking =
            bookingRows[0];

        if (!booking) {

            await callTelegramApi(
                'answerCallbackQuery',
                {
                    callback_query_id:
                        callbackQuery.id,

                    text:
                        'Booking not found'
                }
            );

            return;
        }

        await callTelegramApi(
            'editMessageText',
            {
                chat_id:
                    chatId,

                message_id:
                    messageId,

                text:
                    bookingText(
                        booking
                    ),

                parse_mode:
                    'HTML',

                reply_markup:
                    bookingKeyboard(
                        booking
                    ),

                disable_web_page_preview:
                    true
            }
        );

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id
            }
        );

        return;
    }

    let newBookingStatus =
        null;

    if (
        callbackAction ===
        'confirm'
    ) {
        newBookingStatus =
            'confirmed';
    }

    else if (
        callbackAction ===
        'done'
    ) {
        newBookingStatus =
            'done';
    }

    else if (
        callbackAction ===
        'cancel'
    ) {
        newBookingStatus =
            'cancelled';
    }

    else if (
        callbackAction ===
        'reopen'
    ) {
        newBookingStatus =
            'new';
    }

    if (
        !newBookingStatus
    ) {

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id,

                text:
                    'Unknown action'
            }
        );

        return;
    }

    await sql`
        UPDATE bookings
        SET status =
            ${newBookingStatus}
        WHERE id =
            ${bookingId}
    `;

    const bookingRows =
        await sql`
            SELECT *
            FROM bookings
            WHERE id = ${bookingId}
            LIMIT 1
        `;

    const booking =
        bookingRows[0];

    if (!booking) {

        await callTelegramApi(
            'answerCallbackQuery',
            {
                callback_query_id:
                    callbackQuery.id,

                text:
                    'Booking not found'
            }
        );

        return;
    }

    await callTelegramApi(
        'editMessageText',
        {
            chat_id:
                chatId,

            message_id:
                messageId,

            text:
                bookingText(
                    booking
                ),

            parse_mode:
                'HTML',

            reply_markup:
                bookingKeyboard(
                    booking
                ),

            disable_web_page_preview:
                true
        }
    );

    await callTelegramApi(
        'answerCallbackQuery',
        {
            callback_query_id:
                callbackQuery.id,

            text:
                `→ ${STATUS_NAMES[newBookingStatus]}`
        }
    );
}