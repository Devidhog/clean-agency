const CLEANING_SERVICES = [
    { id: 'standard', emoji: '🧽' },
    { id: 'deep-cleaning', emoji: '✨' },
    { id: 'renovation', emoji: '🛠️' },
    { id: 'upholstery', emoji: '🛋️' }
];

const PROPERTY_SIZES = [
    'studio',
    '1-bedroom',
    '2-bedroom',
    '3-bedroom',
    '4-bedroom'
];

const SERVICE_BASE_PRICES = {
    standard: {
        studio: 40,
        '1-bedroom': 60,
        '2-bedroom': 80,
        '3-bedroom': 100,
        '4-bedroom': 120
    },

    'deep-cleaning': {
        studio: 100,
        '1-bedroom': 120,
        '2-bedroom': 150,
        '3-bedroom': 170,
        '4-bedroom': 210
    },

    renovation: {
        studio: 160,
        '1-bedroom': 185,
        '2-bedroom': 215,
        '3-bedroom': 245,
        '4-bedroom': 275
    }
};

const SERVICE_SIZE_EXTRAS = {
    standard: {
        balcony: 5,
        extraBathroom: 10
    },

    'deep-cleaning': {
        balcony: 10,
        extraBathroom: 20
    },

    renovation: {
        balcony: 30,
        extraBathroom: 30
    }
};

const WINDOW_CLEANING_PRICES = {
    standard: {
        window: 5,
        balconyDoor: 7
    },

    'deep-cleaning': {
        window: 5,
        balconyDoor: 7
    },

    renovation: {
        window: 10,
        balconyDoor: 11
    }
};

const HOUSEHOLD_EXTRA_PRICES = [
    { id: 'tray', price: 10 },
    { id: 'oven', price: 20 },
    { id: 'fridge', price: 15 },
    { id: 'microwave', price: 10 },
    { id: 'bed-linen-change', price: 5 }
];

const UPHOLSTERY_CLEANING_PRICES = [
    { id: 'sofa', price: 50 },
    { id: 'mattress', price: 35 },
    { id: 'armchair', price: 20 },
    { id: 'chair', price: 10 }
];

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

const urlParams =
    new URLSearchParams(window.location.search);

const presetService =
    urlParams.get('service');

const presetPropertySize =
    urlParams.get('size');

const presetUpholsteryItem =
    urlParams.get('item');

let selectedService =
    (
        presetService &&
        CLEANING_SERVICES.some(
            service => service.id === presetService
        )
    )
        ? presetService
        : 'standard';

let selectedPropertySize =
    (
        presetPropertySize &&
        PROPERTY_SIZES.includes(
            presetPropertySize
        )
    )
        ? presetPropertySize
        : 'studio';

let selectedTimeSlot = null;

let appliedPromo = null;

let selectedExtras = {};

let selectedUpholsteryItems = {};

let unavailableTimeSlots = [];

function resetSelections() {
    selectedExtras = {};
    selectedUpholsteryItems = {};
}

if (
    presetUpholsteryItem &&
    UPHOLSTERY_CLEANING_PRICES.some(
        item => item.id === presetUpholsteryItem
    )
) {
    selectedUpholsteryItems[
        presetUpholsteryItem
    ] = 1;
}

function showModal(
    titleKey,
    textKey,
    iconType
) {
    document.getElementById(
        'modalTitle'
    ).textContent = translate(titleKey);

    document.getElementById(
        'modalText'
    ).textContent = translate(textKey);

    const modalIcon =
        document.getElementById(
            'modalIcon'
        );

    modalIcon.className =
        'modal-icon ' +
        (iconType || 'error');

    modalIcon.textContent =
        iconType === 'warn'
            ? '!'
            : '✕';

    document
        .getElementById('modal')
        .classList.add('visible');
}

function hideModal() {
    document
        .getElementById('modal')
        .classList.remove('visible');
}

document
    .getElementById('modalBtn')
    .addEventListener(
        'click',
        hideModal
    );

document
    .getElementById('modal')
    .addEventListener(
        'click',
        event => {

            if (
                event.target.id ===
                'modal'
            ) {
                hideModal();
            }
        }
    );

function renderServiceSelection() {

    const serviceSelectionContainer =
        document.getElementById(
            'svcPick'
        );

    serviceSelectionContainer.innerHTML =
        CLEANING_SERVICES.map(
            service => `

            <div
                class="svc-opt ${
                    selectedService ===
                    service.id
                        ? 'selected'
                        : ''
                }"
                data-service="${service.id}"
            >
                ${service.emoji}
                ${translate(
                    'service.' +
                    service.id +
                    '.n'
                )}
            </div>

        `
        ).join('');

    serviceSelectionContainer
        .querySelectorAll('.svc-opt')
        .forEach(serviceOption => {

            serviceOption.addEventListener(
                'click',
                () => {

                    selectedService =
                        serviceOption.dataset.service;

                    resetSelections();

                    appliedPromo = null;

                    document
                        .getElementById(
                            'promoFeedback'
                        )
                        .textContent = '';

                    renderServiceSelection();
                    renderPropertySizeSelection();
                    renderExtraOptions();
                    updatePriceSummary();
                }
            );
        });

    document
        .getElementById(
            'sizeSectionField'
        )
        .style.display =
            selectedService ===
            'upholstery'
                ? 'none'
                : '';

    document
        .getElementById(
            'extrasField'
        )
        .style.display =
            selectedService ===
            'upholstery'
                ? 'none'
                : '';

    document
        .getElementById(
            'uphField'
        )
        .style.display =
            selectedService ===
            'upholstery'
                ? ''
                : 'none';
}

function renderPropertySizeSelection() {

    if (
        selectedService ===
        'upholstery'
    ) {
        return;
    }

    const propertySizeContainer =
        document.getElementById(
            'sizePick'
        );

    propertySizeContainer.innerHTML =
        PROPERTY_SIZES.map(
            propertySize => `

            <div
                class="svc-opt ${
                    selectedPropertySize ===
                    propertySize
                        ? 'selected'
                        : ''
                }"
                data-size="${propertySize}"
            >
                ${translate(
                    'size.' +
                    propertySize
                )}
            </div>

        `
        ).join('');

    propertySizeContainer
        .querySelectorAll('.svc-opt')
        .forEach(sizeOption => {

            sizeOption.addEventListener(
                'click',
                () => {

                    selectedPropertySize =
                        sizeOption.dataset.size;

                    renderPropertySizeSelection();

                    updatePriceSummary();
                }
            );
        });
}

window.updateQuantity =
function (
    itemId,
    changeAmount
) {

    if (
        itemId.startsWith('u_')
    ) {

        const upholsteryItemId =
            itemId.slice(2);

        selectedUpholsteryItems[
            upholsteryItemId
        ] = Math.max(
            0,
            (
                selectedUpholsteryItems[
                    upholsteryItemId
                ] || 0
            ) + changeAmount
        );

    } else {

        selectedExtras[itemId] =
            Math.max(
                0,
                (
                    selectedExtras[
                        itemId
                    ] || 0
                ) + changeAmount
            );
    }

    renderExtraOptions();
    updatePriceSummary();
};

function renderQuantityControl(
    itemId,
    quantity
) {
    return `
        <div class="qty-ctrl">

            <button
                type="button"
                onclick="updateQuantity('${itemId}', -1)"
            >
                −
            </button>

            <span class="qty-val">
                ${quantity}
            </span>

            <button
                type="button"
                onclick="updateQuantity('${itemId}', 1)"
            >
                +
            </button>

        </div>
    `;
}

function renderExtraOptions() {

    if (
        selectedService ===
        'upholstery'
    ) {

        document.getElementById(
            'uphGrid'
        ).innerHTML =
            UPHOLSTERY_CLEANING_PRICES.map(
                upholsteryItem => `

                <div class="extra-form-item">

                    <div class="left">

                        <span>
                            ${translate(
                                'upholstery.' +
                                upholsteryItem.id
                            )}
                        </span>

                        <span
                            style="
                                color:var(--primary-dark-soft);
                                font-size:11px;
                                margin-left:4px
                            "
                        >
                            ${translate('price.from')}
                            €${upholsteryItem.price}
                        </span>

                    </div>

                    ${renderQuantityControl(
                        'u_' + upholsteryItem.id,
                        selectedUpholsteryItems[
                            upholsteryItem.id
                        ] || 0
                    )}

                </div>

            `
            ).join('');

        return;
    }

    const serviceExtraPrices =
        SERVICE_SIZE_EXTRAS[
            selectedService
        ];

    const windowCleaningPrices =
        WINDOW_CLEANING_PRICES[
            selectedService
        ];

    const extraOptions = [

        {
            id: 'balcony',
            label: translate('extra.balcony'),
            price: serviceExtraPrices.balcony
        },

        {
            id: 'extraBathroom',
            label: translate(
                'extra.extra-bathroom'
            ),
            price:
                serviceExtraPrices.extraBathroom
        },

        {
            id: 'window',
            label: translate('extra.window'),
            price: windowCleaningPrices.window
        },

        {
            id: 'balconyDoor',
            label: translate(
                'extra.balcony-door'
            ),
            price:
                windowCleaningPrices.balconyDoor
        },

        ...HOUSEHOLD_EXTRA_PRICES.map(
            householdExtra => ({
                id: householdExtra.id,
                label: translate(
                    'extra.' +
                    householdExtra.id
                ),
                price:
                    householdExtra.price
            })
        )
    ];

    document.getElementById(
        'extrasGrid'
    ).innerHTML =
        extraOptions.map(
            extraOption => `

            <div class="extra-form-item">

                <div class="left">

                    <span>
                        ${extraOption.label}
                    </span>

                    <span
                        style="
                            color:var(--primary-dark-soft);
                            font-size:11px;
                            margin-left:4px
                        "
                    >
                        €${extraOption.price}
                    </span>

                </div>

                ${renderQuantityControl(
                    extraOption.id,
                    selectedExtras[
                        extraOption.id
                    ] || 0
                )}

            </div>

        `
        ).join('');
}

function calculateBookingPrice() {

    let basePrice = 0;
    let extrasPrice = 0;

    if (
        selectedService ===
        'upholstery'
    ) {

        UPHOLSTERY_CLEANING_PRICES.forEach(
            upholsteryItem => {

                basePrice +=
                    (
                        selectedUpholsteryItems[
                            upholsteryItem.id
                        ] || 0
                    ) *
                    upholsteryItem.price;
            }
        );

    } else {

        basePrice =
            SERVICE_BASE_PRICES[
                selectedService
            ][selectedPropertySize];

        const serviceExtraPrices =
            SERVICE_SIZE_EXTRAS[
                selectedService
            ];

        const windowCleaningPrices =
            WINDOW_CLEANING_PRICES[
                selectedService
            ];

        extrasPrice +=
            (
                selectedExtras.balcony || 0
            ) *
            serviceExtraPrices.balcony;

        extrasPrice +=
            (
                selectedExtras
                    .extraBathroom || 0
            ) *
            serviceExtraPrices.extraBathroom;

        extrasPrice +=
            (
                selectedExtras.window || 0
            ) *
            windowCleaningPrices.window;

        extrasPrice +=
            (
                selectedExtras
                    .balconyDoor || 0
            ) *
            windowCleaningPrices.balconyDoor;

        HOUSEHOLD_EXTRA_PRICES.forEach(
            householdExtra => {

                extrasPrice +=
                    (
                        selectedExtras[
                            householdExtra.id
                        ] || 0
                    ) *
                    householdExtra.price;
            }
        );
    }

    const subtotal =
        basePrice + extrasPrice;

    let discount = 0;

    if (appliedPromo) {

        discount =
            appliedPromo.type ===
            'percent'

                ? Math.round(
                    subtotal *
                    appliedPromo.value /
                    100
                )

                : Math.min(
                    appliedPromo.value,
                    subtotal
                );
    }

    return {
        basePrice,
        extrasPrice,
        discount,
        total:
            subtotal - discount
    };
}

function updatePriceSummary() {

    const priceBreakdown =
        calculateBookingPrice();

    const priceSummaryContainer =
        document.getElementById(
            'priceSummary'
        );

    let summaryHtml = `
        <div class="price-line">
            <span>
                ${translate('summary.base')}
            </span>
            <span>
                €${priceBreakdown.basePrice}
            </span>
        </div>
    `;

    if (
        priceBreakdown.extrasPrice
    ) {

        summaryHtml += `
            <div class="price-line">
                <span>
                    ${translate('summary.extras')}
                </span>
                <span>
                    +€${priceBreakdown.extrasPrice}
                </span>
            </div>
        `;
    }

    if (
        priceBreakdown.discount
    ) {

        summaryHtml += `
            <div class="price-line discount">
                <span>
                    ${translate('summary.discount')}
                    ${
                        appliedPromo
                            ? `(${appliedPromo.code})`
                            : ''
                    }
                </span>

                <span>
                    −€${priceBreakdown.discount}
                </span>
            </div>
        `;
    }

    summaryHtml += `
        <div class="price-line total">

            <span>
                ${translate('summary.total')}
            </span>

            <span>
                €${priceBreakdown.total}
            </span>

        </div>
    `;

    priceSummaryContainer.innerHTML =
        summaryHtml;
}

window.applyPromoCode = async function () {

    const promoCode =
        document
            .getElementById('fPromo')
            .value
            .trim()
            .toUpperCase();

    const promoFeedbackElement =
        document.getElementById(
            'promoFeedback'
        );

    if (!promoCode) {

        promoFeedbackElement.textContent = '';

        appliedPromo = null;

        updatePriceSummary();

        return;
    }

    try {

        const response =
            await fetch(
                '/api/promo-check',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        code: promoCode
                    })
                }
            );

        if (response.ok) {

            const {
                promo: promoDetails
            } = await response.json();

            appliedPromo =
                promoDetails;

            promoFeedbackElement.textContent =
                '✓ ' +
                translate('promo.applied') +
                ' (' +
                (
                    promoDetails.type ===
                    'percent'

                        ? promoDetails.value + '%'

                        : '€' +
                          promoDetails.value
                ) +
                ')';

            promoFeedbackElement.className =
                'promo-feedback ok';

        } else {

            appliedPromo = null;

            promoFeedbackElement.textContent =
                '✗ ' +
                translate('promo.invalid');

            promoFeedbackElement.className =
                'promo-feedback err';
        }

    } catch (error) {

        appliedPromo = null;

        promoFeedbackElement.textContent =
            '✗ Network';

        promoFeedbackElement.className =
            'promo-feedback err';
    }

    updatePriceSummary();
};

let lastAvailableSlotsHash = '';

async function loadAvailableSlots(
    forceRefresh = false
) {

    const selectedDate =
        document.getElementById(
            'fDate'
        ).value;

    if (!selectedDate) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/slots?date=${selectedDate}`
            );

        if (response.ok) {

            const slotData =
                await response.json();

            const bookedSlots =
                slotData.booked || [];

            const blockedSlots =
                slotData.blocked || [];

            const currentSlotsHash =
                [...bookedSlots]
                    .sort()
                    .join(',') +
                '|' +
                [...blockedSlots]
                    .sort()
                    .join(',');

            if (
                currentSlotsHash ===
                    lastAvailableSlotsHash &&
                !forceRefresh
            ) {
                return;
            }

            lastAvailableSlotsHash =
                currentSlotsHash;

            const previousUnavailableTimeSlots =
                unavailableTimeSlots.slice();

            unavailableTimeSlots = [
                ...bookedSlots,
                ...blockedSlots
            ];

            if (
                selectedTimeSlot &&
                unavailableTimeSlots.includes(
                    selectedTimeSlot
                ) &&
                !previousUnavailableTimeSlots.includes(
                    selectedTimeSlot
                )
            ) {

                selectedTimeSlot = null;

                showSlotTakenWarning();
            }
        }

    } catch (error) {

        // silently ignore
    }

    renderTimeSlots();
}

function showSlotTakenWarning() {

    showModal(
        'err.taken.t',
        'err.taken.d',
        'warn'
    );
}

setInterval(() => {

    if (
        document.visibilityState ===
            'visible' &&
        document.getElementById(
            'bookForm'
        ).style.display !== 'none'
    ) {

        loadAvailableSlots();
    }

}, 3000);

function renderTimeSlots() {

    const timeSlotsContainer =
        document.getElementById(
            'timeGrid'
        );

    if (!timeSlotsContainer) {
        return;
    }

    timeSlotsContainer.innerHTML =
        AVAILABLE_TIME_SLOTS.map(
            timeSlot => {

                const isUnavailable =
                    unavailableTimeSlots.includes(
                        timeSlot
                    );

                return `
                    <button
                        type="button"
                        class="
                            time-slot
                            ${
                                selectedTimeSlot ===
                                    timeSlot &&
                                !isUnavailable
                                    ? 'selected'
                                    : ''
                            }
                            ${
                                isUnavailable
                                    ? 'disabled'
                                    : ''
                            }
                        "
                        data-time="${timeSlot}"
                    >
                        ${timeSlot}
                    </button>
                `;
            }
        ).join('');

    timeSlotsContainer
        .querySelectorAll(
            '.time-slot'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    if (
                        button.classList.contains(
                            'disabled'
                        )
                    ) {
                        return;
                    }

                    selectedTimeSlot =
                        button.dataset.time;

                    renderTimeSlots();
                }
            );
        });
}

document
    .getElementById('fDate')
    .addEventListener(
        'change',
        () => {

            selectedTimeSlot = null;

            loadAvailableSlots();
        }
    );

const tomorrowDate =
    new Date();

tomorrowDate.setDate(
    tomorrowDate.getDate() + 1
);

document.getElementById(
    'fDate'
).value =
    tomorrowDate
        .toISOString()
        .split('T')[0];

document.getElementById(
    'fDate'
).min =
    new Date()
        .toISOString()
        .split('T')[0];

document
    .getElementById('bookForm')
    .addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            const submitButton =
                document.getElementById(
                    'submitBtn'
                );

            const customerName =
                document
                    .getElementById('fName')
                    .value
                    .trim();

            const phoneNumber =
                document
                    .getElementById('fPhone')
                    .value
                    .trim();

            const address =
                document
                    .getElementById('fAddr')
                    .value
                    .trim();

            const googleMapsLink =
                document
                    .getElementById('fMapLink')
                    .value
                    .trim();

            const bookingDate =
                document
                    .getElementById('fDate')
                    .value;

            const notes =
                document
                    .getElementById('fNotes')
                    .value
                    .trim();

            document
                .querySelectorAll('.invalid')
                .forEach(field =>
                    field.classList.remove(
                        'invalid'
                    )
                );

            if (!customerName) {

                document
                    .getElementById('fName')
                    .classList.add(
                        'invalid'
                    );

                showModal(
                    'err.missingName.t',
                    'err.missingName.d',
                    'error'
                );

                document
                    .getElementById('fName')
                    .focus();

                return;
            }

            if (
                customerName.length < 2
            ) {

                document
                    .getElementById('fName')
                    .classList.add(
                        'invalid'
                    );

                showModal(
                    'err.shortName.t',
                    'err.shortName.d',
                    'error'
                );

                document
                    .getElementById('fName')
                    .focus();

                return;
            }

            if (!phoneNumber) {

                document
                    .getElementById('fPhone')
                    .classList.add(
                        'invalid'
                    );

                showModal(
                    'err.missingPhone.t',
                    'err.missingPhone.d',
                    'error'
                );

                document
                    .getElementById('fPhone')
                    .focus();

                return;
            }

            if (
                !/^[\d\s+()-]{7,20}$/
                    .test(phoneNumber)
            ) {

                document
                    .getElementById('fPhone')
                    .classList.add(
                        'invalid'
                    );

                showModal(
                    'err.badPhone.t',
                    'err.badPhone.d',
                    'error'
                );

                document
                    .getElementById('fPhone')
                    .focus();

                return;
            }

            if (!address) {

                document
                    .getElementById('fAddr')
                    .classList.add(
                        'invalid'
                    );

                showModal(
                    'err.missingAddr.t',
                    'err.missingAddr.d',
                    'error'
                );

                document
                    .getElementById('fAddr')
                    .focus();

                return;
            }

            if (
                address.length < 5
            ) {

                document
                    .getElementById('fAddr')
                    .classList.add(
                        'invalid'
                    );

                showModal(
                    'err.shortAddr.t',
                    'err.shortAddr.d',
                    'error'
                );

                document
                    .getElementById('fAddr')
                    .focus();

                return;
            }

            if (
                !selectedTimeSlot
            ) {

                showModal(
                    'err.missingTime.t',
                    'err.missingTime.d',
                    'warn'
                );

                return;
            }

            if (
                selectedService ===
                'upholstery'
            ) {

                const totalSelectedUpholsteryItems =
                    UPHOLSTERY_CLEANING_PRICES.reduce(
                        (
                            total,
                            upholsteryItem
                        ) =>
                            total +
                            (
                                selectedUpholsteryItems[
                                    upholsteryItem.id
                                ] || 0
                            ),
                        0
                    );

                if (
                    totalSelectedUpholsteryItems ===
                    0
                ) {

                    showModal(
                        'err.missingUph.t',
                        'err.missingUph.d',
                        'warn'
                    );

                    return;
                }
            }

            if (googleMapsLink) {

                const googleMapsUrlPattern =
                    /^https?:\/\/(www\.)?(maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

                if (
                    !googleMapsUrlPattern.test(
                        googleMapsLink
                    )
                ) {

                    document
                        .getElementById(
                            'fMapLink'
                        )
                        .classList.add(
                            'invalid'
                        );

                    showModal(
                        'err.maplink.t',
                        'err.maplink.d',
                        'error'
                    );

                    return;
                }
            }

            const priceBreakdown =
                calculateBookingPrice();

            const bookingPayload = {

                name: customerName,

                phone: phoneNumber,

                address: address,

                mapLink: googleMapsLink,

                date: bookingDate,

                time: selectedTimeSlot,

                notes,

                service:
                    selectedService,

                size:
                    selectedService ===
                    'upholstery'
                        ? null
                        : selectedPropertySize,

                extras: {
                    ...selectedExtras
                },

                upholsteryItems: {
                    ...selectedUpholsteryItems
                },

                promo:
                    appliedPromo
                        ? appliedPromo.code
                        : null,

                basePrice:
                    priceBreakdown.basePrice,

                extrasPrice:
                    priceBreakdown.extrasPrice,

                discount:
                    priceBreakdown.discount,

                total:
                    priceBreakdown.total
            };

            submitButton.disabled =
                true;

            submitButton.textContent =
                '…';

            try {

                const response =
                    await fetch(
                        '/api/bookings',
                        {
                            method:
                                'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify(
                                    bookingPayload
                                )
                        }
                    );

                if (
                    response.ok
                ) {

                    document
                        .getElementById(
                            'bookForm'
                        )
                        .style.display =
                        'none';

                    document
                        .getElementById(
                            'formHead'
                        )
                        .style.display =
                        'none';

                    document
                        .getElementById(
                            'successScreen'
                        )
                        .classList.add(
                            'visible'
                        );

                    window.scrollTo({
                        top: 0,
                        behavior:
                            'smooth'
                    });

                } else if (
                    response.status ===
                    409
                ) {

                    showModal(
                        'err.taken.t',
                        'err.taken.d',
                        'warn'
                    );

                    await loadAvailableSlots();

                } else {

                    showModal(
                        'err.network.t',
                        'err.network.d',
                        'error'
                    );
                }

            } catch (error) {

                showModal(
                    'err.network.t',
                    'err.network.d',
                    'error'
                );

            } finally {

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    translate('book.submit');
            }
        }
    );

window.renderServiceSelection = renderServiceSelection;
window.renderPropertySizeSelection = renderPropertySizeSelection;
window.renderExtraOptions = renderExtraOptions;
window.renderTimeSlots = renderTimeSlots;
window.updatePriceSummary = updatePriceSummary;
renderServiceSelection();
renderPropertySizeSelection();
renderExtraOptions();
renderTimeSlots();
updatePriceSummary();

applyLang();

loadAvailableSlots();