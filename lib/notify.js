import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

const EXTRA_NAMES = {
    balcony: 'Balcony',

    extraBathroom: 'Extra bathroom',

    window: 'Window',

    balconyDoor: 'Balcony door',

    tray: 'Baking tray',

    oven: 'Oven',

    fridge: 'Fridge',

    microwave: 'Microwave',

    'bed-linen-change': 'Bed linen change'
};

const UPHOLSTERY_NAMES = {
    sofa: 'Sofa',
    mattress: 'Mattress',
    armchair: 'Armchair',
    chair: 'Chair'
};

function formatDate(dateValue, time) {

const date = new Date(dateValue);

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

function formatService(booking) {

const serviceName =
    SERVICE_NAMES[booking.service] ||
    booking.service;

const upholsteryItems =
    booking.upholstery_items|| {};

if (booking.service === 'upholstery') {

    const selectedItems = Object.entries(upholsteryItems)
        .filter(([itemId, quantity]) => quantity > 0)
        .map(([itemId, quantity]) =>
            `${UPHOLSTERY_NAMES[itemId] || itemId} ×${quantity}`
        )
        .join(', ');

    return selectedItems
        ? `${serviceName}: ${selectedItems}`
        : serviceName;
}

const propertySize =
    SIZE_NAMES[booking.property_size] ||
    booking.property_size;

const selectedExtras = Object.entries(
    booking.extras || {}
)
    .filter(([itemId, quantity]) => quantity > 0)
    .map(([itemId, quantity]) =>
        `${EXTRA_NAMES[itemId] || itemId} ×${quantity}`
    )
    .join(', ');

let result = `${serviceName}, ${propertySize}`;

if (selectedExtras) {
    result += ` + ${selectedExtras}`;
}

return result;

}

export async function sendTelegram(
text,
replyMarkup = null
) {

const token = process.env.TELEGRAM_BOT_TOKEN;

const chatIds = (
    process.env.TELEGRAM_CHAT_ID || ''
)
    .split(',')
    .map(chatId => chatId.trim())
    .filter(Boolean);

if (!token || !chatIds.length) return;

await Promise.all(
    chatIds.map(async (chatId) => {

        try {

            const body = {
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            };

            if (replyMarkup) {
                body.reply_markup = replyMarkup;
            }

            const response = await fetch(
                `https://api.telegram.org/bot${token}/sendMessage`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                console.error(
                    'Telegram error for',
                    chatId,
                    ':',
                    await response.text()
                );
            }

        } catch (error) {

            console.error(
                'Telegram fetch failed for',
                chatId,
                ':',
                error
            );
        }
    })
);

}

export async function sendEmail(subject, html) {

const from = process.env.EMAIL_FROM;
const to = process.env.EMAIL_TO;

if (!from || !to) return;

try {

    await resend.emails.send({
        from,
        to,
        subject,
        html
    });

} catch (error) {

    console.error(
        'Email send failed:',
        error
    );
}

}

export async function notifyNewBooking(booking) {

const dateString = formatDate(
    booking.booking_date,
    booking.booking_time
);

const serviceString =
    formatService(booking);

const address =
    booking.address;

const addressLine = booking.map_link
    ? `<a href="${booking.map_link}">${address}</a>`
    : address;

const telegramText =

`🧹 <b>New booking #${booking.id}</b>

<b>Name:</b> ${booking.name} <b>Phone:</b> <a href="tel:${booking.phone}">${booking.phone}</a> <b>Address:</b> ${addressLine} <b>Service:</b> ${serviceString} <b>Date:</b> ${dateString}
${booking.notes ? `<b>Notes:</b> ${booking.notes}\n` : ''}${booking.promo_code ? `<b>Promo:</b> ${booking.promo_code}\n` : ''}<b>Price:</b> €${booking.total}`;

const replyMarkup = {
    inline_keyboard: [
        [
            {
                text: '✅ Confirm',
                callback_data: `confirm:${booking.id}`
            },
            {
                text: '❌ Cancel',
                callback_data: `cancel:${booking.id}`
            }
        ],
        [
            {
                text: '🗑 Delete',
                callback_data: `delconfirm:${booking.id}`
            }
        ]
    ]
};

const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#117559;margin:0 0 20px">🧹 New booking</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;width:140px"><strong>Name:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${booking.name}</td>
    </tr>
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Phone:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">
        <a href="tel:${booking.phone}" style="color:#117559;text-decoration:none">${booking.phone}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Address:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">
        ${address}
        ${booking.map_link ? ` &nbsp; <a href="${booking.map_link}" style="color:#117559">📍 Open in Maps</a>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Service:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${serviceString}</td>
    </tr>
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Date:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${dateString}</td>
    </tr>
    ${booking.notes ? `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Notes:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${booking.notes}</td>
    </tr>` : ''}
    ${booking.promo_code ? `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Promo:</strong></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${booking.promo_code}</td>
    </tr>` : ''}
    <tr>
      <td style="padding:14px 8px;font-size:18px"><strong>Price:</strong></td>
      <td style="padding:14px 8px;font-size:20px;color:#117559">
        <strong>€${booking.total}</strong>
      </td>
    </tr>
  </table>
</div>
`;

await Promise.all([
    sendTelegram(
        telegramText,
        replyMarkup
    ).catch(error =>
        console.error(
            'Telegram failed:',
            error
        )
    ),

    sendEmail(
        `New booking: ${booking.name} · €${booking.total}`,
        emailHtml
    ).catch(error =>
        console.error(
            'Email failed:',
            error
        )
    )
]);

}