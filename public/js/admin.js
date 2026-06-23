const AVAILABLE_TIME_SLOTS = [
'08:00',
'09:00',
'10:00',
'11:00',
'12:00',
'13:00',
'14:00',
'15:00',
'16:00',
'17:00',
'18:00',
'19:00'
];

const SERVICE_NAMES = {
standard: 'Standard cleaning',
'deep-cleaning': 'Deep cleaning',
renovation: 'After renovation',
upholstery: 'Upholstery'
};

function esc(value) {
    return String(value || '').replace(
        /[&<>"']/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character])
    );
}

function showToast(type, title, message) {
const toastContainer = document.getElementById('toastWrap');

if (!toastContainer) return;

const toast = document.createElement('div');

toast.className = 'toast ' + type;

const icon =
    type === 'warning'
        ? '⚠️'
        : type === 'error'
            ? '✕'
            : '✓';

toast.innerHTML =
    '<span class="toast-icon">' + icon + '</span>' +
    '<div class="toast-body">' +
    '<div class="toast-title">' + esc(title) + '</div>' +
    '<div class="toast-msg">' + esc(message) + '</div>' +
    '</div>' +
    '<button class="toast-close" onclick="this.parentElement.classList.add(\'leaving\');setTimeout(()=>this.parentElement.remove(),250)">✕</button>';

toastContainer.appendChild(toast);

setTimeout(() => {
    toast.classList.add('leaving');

    setTimeout(() => {
        toast.remove();
    }, 250);

}, 5000);

}

async function api(url, options = {}) {

const response = await fetch(
    url,
    Object.assign(
        {
            credentials: 'include',
            headers: Object.assign(
                {
                    'Content-Type': 'application/json'
                },
                options.headers || {}
            )
        },
        options
    )
);

if (response.status === 401) {
    showLogin();
    throw new Error('Unauthorized');
}

return response;

}

async function checkAuth() {

try {

    const response = await fetch(
        '/api/auth/admins',
        {
            credentials: 'include'
        }
    );

    if (response.ok) {

        const data =
            await response.json();

        showAdmin(data.admin);

        return true;
    }

} catch (error) {
    // ignore
}

showLogin();

return false;

}

function showLogin() {

document.getElementById(
    'loginWrap'
).style.display = 'grid';

document.getElementById(
    'adminWrap'
).classList.remove('visible');

}

let pollingStarted = false;

function showAdmin(admin) {

document.getElementById(
    'loginWrap'
).style.display = 'none';

document.getElementById(
    'adminWrap'
).classList.add('visible');

document.getElementById(
    'userEmail'
).textContent = admin.email;

const tomorrowDate = new Date();

tomorrowDate.setDate(
    tomorrowDate.getDate() + 1
);

document.getElementById(
    'slotDate'
).value =
    tomorrowDate
        .toISOString()
        .split('T')[0];

loadBookings();
loadSlots();
loadPromos();

if (!pollingStarted) {

    pollingStarted = true;

    startPolling();
}

}

document.getElementById('loginForm').addEventListener(
    'submit',
    async event => {

        event.preventDefault();

        const loginButton =
            document.getElementById(
                'loginBtn'
            );

        const loginError =
            document.getElementById(
                'loginError'
            );

        loginError.classList.remove(
            'visible'
        );

        loginButton.disabled = true;
        loginButton.textContent =
            'Signing in…';

        try {

            const response =
                await fetch(
                    '/api/auth/login',
                    {
                        method: 'POST',

                        credentials:
                            'include',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                email:
                                    document.getElementById(
                                        'loginEmail'
                                    ).value,

                                password:
                                    document.getElementById(
                                        'loginPassword'
                                    ).value
                            })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                loginError.textContent =
                    data.error ||
                    'Login failed';

                loginError.classList.add(
                    'visible'
                );

            } else {

                showAdmin(
                    data.admin
                );

                document.getElementById(
                    'loginForm'
                ).reset();
            }

        } catch (error) {

            loginError.textContent =
                'Network error';

            loginError.classList.add(
                'visible'
            );

        } finally {

            loginButton.disabled =
                false;

            loginButton.textContent =
                'Sign in';
        }
    }
);

async function doLogout() {

    await fetch(
        '/api/auth/logout',
        {
            method: 'POST',
            credentials: 'include'
        }
    );

    showLogin();
}

document.querySelectorAll('.admin-tab').forEach(
    adminTab => {

        adminTab.addEventListener(
            'click',
            () => {

                document
                    .querySelectorAll(
                        '.admin-tab'
                    )
                    .forEach(
                        tab =>
                            tab.classList.remove(
                                'active'
                            )
                    );

                document
                    .querySelectorAll(
                        '.admin-content'
                    )
                    .forEach(
                        content =>
                            content.classList.remove(
                                'active'
                            )
                    );

                adminTab.classList.add(
                    'active'
                );

                document.getElementById(
                    'tab-' +
                    adminTab.dataset.tab
                ).classList.add(
                    'active'
                );
            }
        );
    }
);

let currentBookingsHash = '';

let isPolling = false;

let lastSeenBookings =
    new Map();

function hashBookings(
    bookings
) {
    return bookings
        .map(
            booking =>
                booking.id +
                ':' +
                booking.status
        )
        .sort()
        .join(',');
}

function detectChanges(
    newBookings
) {

    const newBookingMap =
        new Map(
            newBookings.map(
                booking => [
                    booking.id,
                    booking
                ]
            )
        );

    for (
        const booking of
        newBookings
    ) {

        const previousBooking =
            lastSeenBookings.get(
                booking.id
            );

        if (
            !previousBooking
        ) {

            if (
                lastSeenBookings.size >
                0
            ) {

                showToast(
                    'info',
                    '🆕 New booking',
                    booking.name +
                        ' · €' +
                        booking.total +
                        ' · ' +
                        booking.booking_date +
                        ' ' +
                        booking.booking_time
                );
            }

        } else if (
            previousBooking.status !==
            booking.status
        ) {

            showToast(
                'info',
                'Status updated',
                booking.name +
                    ' → ' +
                    booking.status
            );
        }
    }

    for (
        const [
            bookingId,
            previousBooking
        ] of lastSeenBookings
    ) {

        if (
            !newBookingMap.has(
                bookingId
            )
        ) {

            showToast(
                'warning',
                '🗑 Booking deleted',
                previousBooking.name
            );
        }
    }

    lastSeenBookings =
        newBookingMap;
}

async function loadBookings(showLoader = true) {

    const bookingsList =
        document.getElementById(
            'bookingsList'
        );

    if (showLoader) {

        bookingsList.innerHTML =
            '<div class="empty">Loading…</div>';
    }

    try {

        const response =
            await api(
                '/api/bookings'
            );

        const data =
            await response.json();

        const bookingRows =
            data.bookings || [];

        const newBookingsHash =
            hashBookings(
                bookingRows
            );

        if (
            newBookingsHash ===
                currentBookingsHash &&
            !showLoader
        ) {

            lastSeenBookings =
                new Map(
                    bookingRows.map(
                        booking => [
                            booking.id,
                            booking
                        ]
                    )
                );

            return;
        }

        if (
            currentBookingsHash &&
            newBookingsHash !==
                currentBookingsHash
        ) {

            detectChanges(
                bookingRows
            );

        } else if (
            !currentBookingsHash
        ) {

            lastSeenBookings =
                new Map(
                    bookingRows.map(
                        booking => [
                            booking.id,
                            booking
                        ]
                    )
                );
        }

        currentBookingsHash =
            newBookingsHash;

        if (
            !bookingRows.length
        ) {

            bookingsList.innerHTML =
                '<div class="empty">No bookings yet.</div>';

            return;
        }

        let html =
            '<div style="overflow-x:auto"><table class="req-table"><thead><tr>';

        html +=
            '<th>When</th><th>Client</th><th>Service</th><th>Address</th><th>Total</th><th>Status</th><th>Actions</th>';

        html +=
            '</tr></thead><tbody>';

        for (
            const booking of
            bookingRows
        ) {

            html +=
                '<tr data-id="' +
                booking.id +
                '" data-status="' +
                booking.status +
                '">';

            html +=
                '<td><strong>' +
                booking.booking_date +
                '</strong><br/><span style="color:var(--primary-dark-soft)">' +
                booking.booking_time +
                '</span></td>';

            html +=
                '<td><strong>' +
                esc(
                    booking.name
                ) +
                '</strong><br/><a href="tel:' +
                booking.phone +
                '" style="color:var(--mint-700)">' +
                esc(
                    booking.phone
                ) +
                '</a></td>';

            html +=
                '<td>' +
                (
                    SERVICE_NAMES[
                        booking.service
                    ] ||
                    booking.service
                ) +
                '<br/><span style="color:var(--primary-dark-soft);font-size:11px">' +
                (
                    booking.property_size ||
                    '—'
                ) +
                (
                    booking.promo_code
                        ? ' · 🏷 ' +
                          booking.promo_code
                        : ''
                ) +
                '</span></td>';

            html +=
                '<td style="max-width:240px;font-size:12px">' +
                esc(
                    booking.address
                );

            if (
                booking.map_link
            ) {

                html +=
                    '<br/><a href="' +
                    esc(
                        booking.map_link
                    ) +
                    '" target="_blank" style="color:var(--mint-700);font-size:11px">📍 Maps</a>';
            }

            if (
                booking.notes
            ) {

                html +=
                    '<br/><span style="color:var(--primary-dark-soft);font-size:11px;font-style:italic">' +
                    esc(
                        booking.notes
                    ) +
                    '</span>';
            }

            html += '</td>';

            html +=
                '<td style="font-family:\'Fraunces\',serif;font-weight:700;font-size:16px">€' +
                booking.total +
                '</td>';

            html +=
                '<td><span class="status status-' +
                booking.status +
                '">' +
                booking.status +
                '</span></td>';

            html +=
                '<td><div class="req-actions">';

            if (
                booking.status ===
                'new'
            ) {

                html +=
                    '<button class="btn-mini confirm" onclick="updateStatus(' +
                    booking.id +
                    ',\'confirmed\',\'' +
                    booking.status +
                    '\')">✓ Confirm</button>';
            }

            if (
                booking.status !==
                    'done' &&
                booking.status !==
                    'cancelled'
            ) {

                html +=
                    '<button class="btn-mini done" onclick="updateStatus(' +
                    booking.id +
                    ',\'done\',\'' +
                    booking.status +
                    '\')">✓✓ Done</button>';
            }

            html +=
                '<button class="btn-mini del" onclick="deleteBooking(' +
                booking.id +
                ',\'' +
                booking.status +
                '\')">✕</button>';

            html +=
                '</div></td>';

            html += '</tr>';
        }

        html +=
            '</tbody></table></div>';

        bookingsList.innerHTML =
            html;

    } catch (error) {

        if (showLoader) {

            bookingsList.innerHTML =
                '<div class="empty" style="color:var(--red)">Failed to load bookings</div>';
        }
    }
}

let currentSlotsHash = '';

let currentPromosHash = '';

function hashSlots(
    bookedSlots,
    blockedSlots
) {
    return (
        [...bookedSlots]
            .sort()
            .join(',') +
        '|' +
        [...blockedSlots]
            .sort()
            .join(',')
    );
}

function hashPromos(
    promoRows
) {
    return promoRows
        .map(
            promoCode =>
                promoCode.id +
                ':' +
                promoCode.used +
                ':' +
                promoCode.max_uses
        )
        .sort()
        .join(',');
}

async function loadSlotsQuiet() {

    const slotDate =
        document.getElementById(
            'slotDate'
        ).value;

    if (!slotDate) {
        return;
    }

    try {

        const response =
            await fetch(
                '/api/slots?date=' +
                slotDate,
                {
                    credentials:
                        'include'
                }
            );

        const data =
            await response.json();

        const bookedSlots =
            data.booked || [];

        const blockedSlots =
            data.blocked || [];

        const slotsHash =
            hashSlots(
                bookedSlots,
                blockedSlots
            );

        if (
            slotsHash ===
            currentSlotsHash
        ) {
            return;
        }

        currentSlotsHash =
            slotsHash;

        const slotGrid =
            document.getElementById(
                'slotGrid'
            );

        slotGrid.innerHTML =
            AVAILABLE_TIME_SLOTS.map(
                timeSlot => {

                    let slotClass =
                        '';

                    if (
                        bookedSlots.includes(
                            timeSlot
                        )
                    ) {

                        slotClass =
                            'booked';

                    } else if (
                        blockedSlots.includes(
                            timeSlot
                        )
                    ) {

                        slotClass =
                            'blocked';
                    }

                    return (
                        '<div class="slot-cell ' +
                        slotClass +
                        '" data-t="' +
                        timeSlot +
                        '">' +
                        timeSlot +
                        '</div>'
                    );
                }
            ).join('');

        slotGrid
            .querySelectorAll(
                '.slot-cell'
            )
            .forEach(
                slotCell => {

                    slotCell.addEventListener(
                        'click',
                        async () => {

                            if (
                                slotCell.classList.contains(
                                    'booked'
                                )
                            ) {
                                return;
                            }

                            const slotTime =
                                slotCell.dataset.t;

                            const action =
                                slotCell.classList.contains(
                                    'blocked'
                                )
                                    ? 'unblock'
                                    : 'block';

                            await api(
                                '/api/slots',
                                {
                                    method:
                                        'POST',

                                    body:
                                        JSON.stringify(
                                            {
                                                date:
                                                    slotDate,
                                                time:
                                                    slotTime,
                                                action
                                            }
                                        )
                                }
                            );

                            currentSlotsHash =
                                '';

                            loadSlotsQuiet();
                        }
                    );
                }
            );

    } catch (error) {
        // ignore
    }
}

async function loadPromosQuiet() {

    try {

        const response =
            await api(
                '/api/promos'
            );

        const data =
            await response.json();

        const promoRows =
            data.promos || [];

        const promosHash =
            hashPromos(
                promoRows
            );

        if (
            promosHash ===
            currentPromosHash
        ) {
            return;
        }

        currentPromosHash =
            promosHash;

        const promoList =
            document.getElementById(
                'promoList'
            );

        if (
            !promoRows.length
        ) {

            promoList.innerHTML =
                '<div class="empty">No promo codes yet.</div>';

            return;
        }

        let html = '';

        for (
            const promoCode of
            promoRows
        ) {

            const isExpired =
                promoCode.max_uses >
                    0 &&
                promoCode.used >=
                    promoCode.max_uses;

            html +=
                '<div class="promo-card"' +
                (
                    isExpired
                        ? ' style="opacity:.5"'
                        : ''
                ) +
                '><div>';

            html +=
                '<div class="code">' +
                esc(
                    promoCode.code
                ) +
                (
                    isExpired
                        ? ' <span style="font-size:11px;color:var(--red);font-family:Manrope;font-weight:600">EXPIRED</span>'
                        : ''
                ) +
                '</div>';

            html +=
                '<div class="info">' +
                (
                    promoCode.discount_type ===
                    'percent'
                        ? promoCode.discount_value +
                          '%'
                        : '€' +
                          promoCode.discount_value
                ) +
                ' off · max: ' +
                (
                    promoCode.max_uses ===
                    0
                        ? '∞'
                        : promoCode.max_uses
                ) +
                ' · used: ' +
                promoCode.used +
                '</div>';

            html +=
                '</div>';

            html +=
                '<button class="btn-mini del" onclick="deletePromo(' +
                promoCode.id +
                ')">Delete</button>';

            html +=
                '</div>';
        }

        promoList.innerHTML =
            html;

    } catch (error) {
        // ignore
    }
}

function startPolling() {

    setInterval(
        () => {

            if (
                !isPolling &&
                document.visibilityState ===
                    'visible'
            ) {

                isPolling = true;

                Promise.all([
                    loadBookings(false),
                    loadSlotsQuiet(),
                    loadPromosQuiet()
                ]).finally(
                    () => {
                        isPolling = false;
                    }
                );
            }

        },
        2000
    );
}

async function updateStatus(
    bookingId,
    status,
    expectedStatus
) {

    const bookingRow =
        document.querySelector(
            'tr[data-id="' +
            bookingId +
            '"]'
        );

    if (bookingRow) {
        bookingRow.style.opacity =
            '0.5';
    }

    try {

        const response =
            await api(
                '/api/bookings',
                {
                    method: 'PATCH',

                    body:
                        JSON.stringify(
                            {
                                id: bookingId,
                                status,
                                expectedStatus
                            }
                        )
                }
            );

        if (
            response.status ===
            409
        ) {

            const data =
                await response.json();

            showToast(
                'warning',
                '⚠️ Conflict',
                (
                    data.bookingName ||
                    'Booking'
                ) +
                ' was already updated by another admin to "' +
                data.currentStatus +
                '". Refreshing…'
            );

        } else if (
            !response.ok
        ) {

            let errorData =
                {};

            try {

                errorData =
                    await response.json();

            } catch (
                error
            ) {
                // ignore
            }

            showToast(
                'error',
                'Failed to update',
                errorData.error ||
                    'Try again.'
            );
        }

        currentBookingsHash =
            '';

        await loadBookings(
            false
        );

    } catch (error) {

        showToast(
            'error',
            'Network error',
            'Could not reach the server.'
        );

        if (bookingRow) {

            bookingRow.style.opacity =
                '';
        }
    }
}

async function deleteBooking(
    bookingId,
    expectedStatus
) {

    if (
        !confirm(
            'Delete this booking?'
        )
    ) {
        return;
    }

    const bookingRow =
        document.querySelector(
            'tr[data-id="' +
            bookingId +
            '"]'
        );

    if (bookingRow) {
        bookingRow.style.opacity =
            '0.5';
    }

    try {

        const response =
            await api(
                '/api/bookings',
                {
                    method: 'DELETE',

                    body:
                        JSON.stringify(
                            {
                                id: bookingId,
                                expectedStatus
                            }
                        )
                }
            );

        if (
            response.status ===
            409
        ) {

            const data =
                await response.json();

            showToast(
                'warning',
                '⚠️ Conflict',
                (
                    data.bookingName ||
                    'Booking'
                ) +
                ' was updated by another admin. Refreshing…'
            );

        } else if (
            response.status ===
            404
        ) {

            showToast(
                'info',
                'Already deleted',
                'This booking was already removed.'
            );

        } else if (
            !response.ok
        ) {

            let errorData =
                {};

            try {

                errorData =
                    await response.json();

            } catch (
                error
            ) {
                // ignore
            }

            showToast(
                'error',
                'Failed to delete',
                errorData.error ||
                    'Try again.'
            );
        }

        currentBookingsHash =
            '';

        await loadBookings(
            false
        );

        currentSlotsHash =
            '';

        loadSlotsQuiet();

    } catch (error) {

        showToast(
            'error',
            'Network error',
            'Could not reach the server.'
        );

        if (bookingRow) {

            bookingRow.style.opacity =
                '';
        }
    }
}

async function loadSlots() {

    const slotDate =
        document.getElementById(
            'slotDate'
        ).value;

    if (!slotDate) {
        return;
    }

    const slotGrid =
        document.getElementById(
            'slotGrid'
        );

    try {

        const response =
            await fetch(
                '/api/slots?date=' +
                slotDate,
                {
                    credentials:
                        'include'
                }
            );

        const data =
            await response.json();

        const bookedSlots =
            data.booked || [];

        const blockedSlots =
            data.blocked || [];

        slotGrid.innerHTML =
            AVAILABLE_TIME_SLOTS
                .map(timeSlot => {

                    let slotClass =
                        '';

                    if (
                        bookedSlots.includes(
                            timeSlot
                        )
                    ) {

                        slotClass =
                            'booked';

                    } else if (
                        blockedSlots.includes(
                            timeSlot
                        )
                    ) {

                        slotClass =
                            'blocked';
                    }

                    return `
                        <div
                            class="slot-cell ${slotClass}"
                            data-t="${timeSlot}"
                        >
                            ${timeSlot}
                        </div>
                    `;

                })
                .join('');

        slotGrid
            .querySelectorAll(
                '.slot-cell'
            )
            .forEach(
                slotCell => {

                    slotCell.addEventListener(
                        'click',
                        async () => {

                            if (
                                slotCell.classList.contains(
                                    'booked'
                                )
                            ) {
                                return;
                            }

                            const slotTime =
                                slotCell.dataset.t;

                            const action =
                                slotCell.classList.contains(
                                    'blocked'
                                )
                                    ? 'unblock'
                                    : 'block';

                            await api(
                                '/api/slots',
                                {
                                    method:
                                        'POST',

                                    body:
                                        JSON.stringify(
                                            {
                                                date:
                                                    slotDate,

                                                time:
                                                    slotTime,

                                                action
                                            }
                                        )
                                }
                            );

                            loadSlots();
                        }
                    );
                }
            );

    } catch (error) {

        slotGrid.innerHTML =
            '<div class="empty">Failed to load slots</div>';
    }
}

document
    .getElementById(
        'slotDate'
    )
    .addEventListener(
        'change',
        () => {

            currentSlotsHash =
                '';

            loadSlotsQuiet();
        }
    );

async function loadPromos() {

    const promoList =
        document.getElementById(
            'promoList'
        );

    try {

        const response =
            await api(
                '/api/promos'
            );

        const data =
            await response.json();

        const promoRows =
            data.promos || [];

        if (
            !promoRows.length
        ) {

            promoList.innerHTML =
                '<div class="empty">No promo codes yet.</div>';

            return;
        }

        let html = '';

        for (
            const promoCode of
            promoRows
        ) {

            html +=
                '<div class="promo-card"><div>';

            html +=
                '<div class="code">' +
                esc(
                    promoCode.code
                ) +
                '</div>';

            html +=
                '<div class="info">' +
                (
                    promoCode.discount_type ===
                    'percent'

                        ? promoCode.discount_value +
                          '%'

                        : '€' +
                          promoCode.discount_value
                ) +
                ' off · max: ' +
                (
                    promoCode.max_uses ===
                    0

                        ? '∞'

                        : promoCode.max_uses
                ) +
                ' · used: ' +
                promoCode.used +
                '</div>';

            html +=
                '</div>';

            html +=
                '<button class="btn-mini del" onclick="deletePromo(' +
                promoCode.id +
                ')">Delete</button>';

            html +=
                '</div>';
        }

        promoList.innerHTML =
            html;

    } catch (error) {

        promoList.innerHTML =
            '<div class="empty" style="color:var(--red)">Failed to load promos</div>';
    }
}

async function addPromo() {

const promoCode =
    document.getElementById(
        'newCode'
    )
    .value
    .trim()
    .toUpperCase();

const discountType =
    document.getElementById(
        'newType'
    ).value;

const discountValue =
    parseInt(
        document.getElementById(
            'newValue'
        ).value
    ) || 0;

const maxUses =
    parseInt(
        document.getElementById(
            'newMax'
        ).value
    ) || 0;

if (
    !promoCode ||
    !discountValue
) {

    showToast(
        'error',
        'Missing data',
        'Code and value are required.'
    );

    return;
}

if (
    discountType === 'percent' &&
    discountValue > 100
) {

    showToast(
        'error',
        'Invalid discount',
        'Percentage cannot exceed 100%.'
    );

    return;
}

const response =
    await api(
        '/api/promos',
        {
            method: 'POST',

            body: JSON.stringify({
                code: promoCode,
                type: discountType,
                value: discountValue,
                maxUses
            })
        }
    );

if (response.ok) {

    document.getElementById(
        'newCode'
    ).value = '';

    document.getElementById(
        'newValue'
    ).value = '';

    document.getElementById(
        'newMax'
    ).value = '0';

    showToast(
        'info',
        'Promo created',
        promoCode +
        ' is ready to use.'
    );

    currentPromosHash = '';

    loadPromosQuiet();

} else {

    const error =
        await response
            .json()
            .catch(
                () => ({})
            );

    showToast(
        'error',
        'Failed',
        error.error ||
        'Could not create code.'
    );
}

}


async function deletePromo(
    id
) {

    if (
        !confirm(
            'Delete this promo code?'
        )
    ) {
        return;
    }

    await api(
        '/api/promos',
        {
            method: 'DELETE',

            body: JSON.stringify({
                id
            })
        }
    );

    currentPromosHash = '';

    loadPromosQuiet();
}

checkAuth();

// window.doLogout = doLogout;
// window.addPromo = addPromo;
// window.deletePromo = deletePromo;
// window.updateStatus = updateStatus;
// window.deleteBooking = deleteBooking;
// window.loadSlotsQuiet = loadSlotsQuiet;