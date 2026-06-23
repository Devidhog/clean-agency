// public/js/script.js

import { I18N } from './translations.js';

/* =========================
   MOBILE MENU
========================= */

function toggleMenu() {
    const menu = document.getElementById('mobileMenu');
    const burger = document.getElementById('burger');

    menu.classList.toggle('visible');
    burger.classList.toggle('open');
}

function closeMenu() {
    document.getElementById('mobileMenu').classList.remove('visible');
    document.getElementById('burger').classList.remove('open');
}

window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;

/* =========================
LANGUAGE SYSTEM
========================= */

let currentLang = localStorage.getItem('cleanLang') || 'en';
window.currentLang = currentLang;

function translate(key) {
    return (
        (I18N[currentLang] || {})[key] ||
        I18N.en[key] ||
        key
    );
}
window.translate = translate;

function applyLang() {
document.documentElement.lang = currentLang;

document
    .querySelectorAll('[data-i18n]')
    .forEach(element => {
        element.textContent = translate(
            element.dataset.i18n
        );
    });

document
    .querySelectorAll('[data-i18n-placeholder]')
    .forEach(element => {
        element.placeholder = translate(
            element.dataset.i18nPlaceholder
        );
    });

document
    .querySelectorAll('#langSwitch button')
    .forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.lang === currentLang
        );
    });

    if (typeof renderPricingPage === 'function') {
    renderPricingPage();
    }

    if (typeof loadHeroSliderImages === 'function') {
        loadHeroSliderImages();
    }

    if (typeof renderServiceSelection === 'function') {
        renderServiceSelection();
    }

    if (typeof renderPropertySizeSelection === 'function') {
        renderPropertySizeSelection();
    }

    if (typeof renderExtraOptions === 'function') {
        renderExtraOptions();
    }

    if (typeof renderTimeSlots === 'function') {
        renderTimeSlots();
    }

    if (typeof updatePriceSummary === 'function') {
        updatePriceSummary();
    }
}

window.applyLang = applyLang;

document.addEventListener('DOMContentLoaded', () => {

    document
        .querySelectorAll('#langSwitch button')
        .forEach(button => {

            button.addEventListener('click', () => {

                currentLang = button.dataset.lang;
                window.currentLang = currentLang;

                localStorage.setItem(
                    'cleanLang',
                    currentLang
                );

                applyLang();
            });
        });

    applyLang();
});


/* =========================
   PRICING
========================= */

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
    { id: 'tray', p: 10 },
    { id: 'oven', p: 20 },
    { id: 'fridge', p: 15 },
    { id: 'microwave', p: 10 },
    { id: 'bed-linen-change', p: 5 }
];

const UPHOLSTERY_CLEANING_PRICES = [
    { id: 'sofa', p: 50 },
    { id: 'mattress', p: 35 },
    { id: 'armchair', p: 20 },
    { id: 'chair', p: 10 }
];

let activePricingService = 'standard';


function renderPricingPage() {

const pricingTabsContainer =
    document.getElementById('pricingTabs');

const pricingContentContainer =
    document.getElementById('pricingContent');

if (
    !pricingTabsContainer ||
    !pricingContentContainer
) {
    return;
}

pricingTabsContainer.innerHTML =
    CLEANING_SERVICES.map(service => `
        <button
            class="pricing-tab ${
                activePricingService === service.id
                    ? 'active'
                    : ''
            }"
            data-service="${service.id}"
        >
            <span class="emoji">
                ${service.emoji}
            </span>

            ${translate(
                'service.' +
                service.id +
                '.n'
            )}
        </button>
    `).join('');

pricingTabsContainer
    .querySelectorAll('.pricing-tab')
    .forEach(button => {

        button.addEventListener(
            'click',
            () => {

                activePricingService =
                    button.dataset.service;

                renderPricingPage();
            }
        );
    });

let html = '';

if (
    activePricingService ===
    'upholstery'
) {

    html += `
        <div class="pricing-table">

            <div class="pricing-row header">

                <div class="desc">
                    ${translate(
                        'pricing.uphItems'
                    )}
                </div>

                <div class="price-val">
                    ${translate(
                        'price.from'
                    )}
                </div>

            </div>

            ${UPHOLSTERY_CLEANING_PRICES
                .map(item => `

                <div class="pricing-row">

                    <div class="desc">
                        ${translate(
                            'upholstery.' +
                            item.id
                        )}
                    </div>

                    <div class="price-val">
                        €${item.p}
                    </div>

                    <a
                        class="book-row-btn"
                        href="/book?service=upholstery&item=${item.id}"
                    >
                        ${translate(
                            'services.book'
                        )} →
                    </a>

                </div>

            `).join('')}

        </div>
    `;

} else {

    const serviceBasePrices =
        SERVICE_BASE_PRICES[
            activePricingService
        ];

    const serviceSizeExtras =
        SERVICE_SIZE_EXTRAS[
            activePricingService
        ];

    const windowCleaningPrices =
        WINDOW_CLEANING_PRICES[
            activePricingService
        ];

    html += `
        <div class="pricing-table">

            <div class="pricing-row header">

                <div class="desc">
                    ${translate(
                        'pricing.base'
                    )}
                </div>

                <div class="price-val">
                    €
                </div>

            </div>

            ${PROPERTY_SIZES
                .map(size => `

                <div class="pricing-row">

                    <div class="desc">
                        ${translate(
                            'size.' +
                            size
                        )}
                    </div>

                    <div class="price-val">
                        €${serviceBasePrices[size]}
                    </div>

                    <a
                        class="book-row-btn"
                        href="/book?service=${activePricingService}&size=${size}"
                    >
                        ${translate(
                            'services.book'
                        )} →
                    </a>

                </div>

            `).join('')}

        </div>
    `;

    html += `
        <div class="pricing-extras">

            <div class="pricing-extras-title">
                ${translate(
                    'pricing.extras'
                )}
            </div>

            <div class="extras-grid">

                <div class="extra-chip">

                    <span>
                        ${translate(
                            'extra.balcony'
                        )}
                    </span>

                    <span class="ep">
                        €${serviceSizeExtras.balcony}
                    </span>

                </div>

                <div class="extra-chip">

                    <span>
                        ${translate(
                            'extra.extra-bathroom'
                        )}
                    </span>

                    <span class="ep">
                        €${serviceSizeExtras.extraBathroom}
                    </span>

                </div>

            </div>

        </div>
    `;

    html += `
        <div
            class="pricing-extras"
            style="margin-top:20px"
        >

            <div class="pricing-extras-title">
                ${translate(
                    'pricing.windows'
                )}
            </div>

            <div class="extras-grid">

                <div class="extra-chip">

                    <span>
                        ${translate(
                            'extra.window'
                        )}
                    </span>

                    <span class="ep">
                        €${windowCleaningPrices.window}
                        /
                        ${translate(
                            'price.each'
                        )}
                    </span>

                </div>

                <div class="extra-chip">

                    <span>
                        ${translate(
                            'extra.balcony-door'
                        )}
                    </span>

                    <span class="ep">
                        €${windowCleaningPrices.balconyDoor}
                        /
                        ${translate(
                            'price.each'
                        )}
                    </span>

                </div>

            </div>

        </div>
    `;

    html += `
        <div
            class="pricing-extras"
            style="margin-top:20px"
        >

            <div class="pricing-extras-title">
                ${translate(
                    'pricing.household'
                )}
            </div>

            <div class="extras-grid">

                ${HOUSEHOLD_EXTRA_PRICES
                    .map(extra => `

                    <div class="extra-chip">

                        <span>
                            ${translate(
                                'extra.' +
                                extra.id
                            )}
                        </span>

                        <span class="ep">
                            €${extra.p}
                        </span>

                    </div>

                `).join('')}

            </div>

        </div>
    `;
}

pricingContentContainer.innerHTML =
    html;

}

/* =========================
   HERO SLIDER
========================= */

const HERO_SLIDER_IMAGES = {

en: [
    'assets/images/en/hero-1.PNG',
    'assets/images/en/hero-2.PNG',
    'assets/images/en/hero-3.PNG',
    'assets/images/en/hero-4.PNG'
],

el: [
    'assets/images/el/hero-1.PNG',
    'assets/images/el/hero-2.PNG',
    'assets/images/el/hero-3.PNG',
    'assets/images/el/hero-4.PNG'
],

ru: [
    'assets/images/ru/hero-1.PNG',
    'assets/images/ru/hero-2.PNG',
    'assets/images/ru/hero-3.PNG',
    'assets/images/ru/hero-4.PNG'
]

};

let activeHeroSlideIndex = 0;

let heroSliderInterval = null;

function loadHeroSliderImages() {

const languageImages =
    HERO_SLIDER_IMAGES[currentLang] ||
    HERO_SLIDER_IMAGES.en;

document
    .querySelectorAll('.hero-slide')
    .forEach((slideImage, index) => {

        slideImage.src =
            languageImages[index];
    });

}

function showHeroSlide(slideIndex) {
activeHeroSlideIndex =
    slideIndex;

document
    .querySelectorAll('.hero-slide')
    .forEach((slide, index) => {

        slide.classList.toggle(
            'active',
            index === slideIndex
        );
    });

document
    .querySelectorAll('.hero-dot')
    .forEach((dot, index) => {

        dot.classList.toggle(
            'active',
            index === slideIndex
        );
    });

}

function showNextHeroSlide() {
showHeroSlide(
    (
        activeHeroSlideIndex + 1
    ) % 4
);

}

function startHeroSliderAutoPlay() {

clearInterval(
    heroSliderInterval
);

heroSliderInterval =
    setInterval(
        showNextHeroSlide,
        3000
    );

}

document.addEventListener(
    'DOMContentLoaded',
    () => {

        document
            .querySelectorAll('.hero-dot')
            .forEach(dot => {

                dot.addEventListener(
                    'click',
                    () => {

                        showHeroSlide(
                            parseInt(dot.dataset.d)
                        );

                        startHeroSliderAutoPlay();
                    }
                );
            });

        loadHeroSliderImages();
        showHeroSlide(0);
        startHeroSliderAutoPlay();
    }
);