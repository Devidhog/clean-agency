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

function t(key) {
    return (
        (I18N[currentLang] || {})[key] ||
        I18N.en[key] ||
        key
    );
}

function applyLang() {

    document.documentElement.lang = currentLang;

    document
        .querySelectorAll('[data-i18n]')
        .forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });

    document
        .querySelectorAll('#langSwitch button')
        .forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.lang === currentLang
            );
        });

    renderPricingPage();
    loadHeroImages();
}

document
    .querySelectorAll('#langSwitch button')
    .forEach(button => {

        button.addEventListener('click', () => {

            currentLang = button.dataset.lang;

            localStorage.setItem(
                'cleanLang',
                currentLang
            );

            applyLang();
        });
    });

/* =========================
   PRICING
========================= */

const SVCS = [
    { id:'standard', emoji:'🧽' },
    { id:'deep', emoji:'✨' },
    { id:'reno', emoji:'🛠️' },
    { id:'upholstery', emoji:'🛋️' }
];

const SIZES = [
    'studio',
    '1br',
    '2br',
    '3br',
    '4br'
];

const BASE = {

    standard:{
        studio:40,
        '1br':60,
        '2br':80,
        '3br':100,
        '4br':120
    },

    deep:{
        studio:100,
        '1br':120,
        '2br':150,
        '3br':170,
        '4br':210
    },

    reno:{
        studio:160,
        '1br':185,
        '2br':215,
        '3br':245,
        '4br':275
    }
};

const SZ_EX = {

    standard:{
        balcony:5,
        extrabath:10
    },

    deep:{
        balcony:10,
        extrabath:20
    },

    reno:{
        balcony:30,
        extrabath:30
    }
};

const WIN = {

    standard:{
        window:5,
        balcondoor:7
    },

    deep:{
        window:5,
        balcondoor:7
    },

    reno:{
        window:10,
        balcondoor:11
    }
};

const HOUSE = [
    { id:'tray', p:10 },
    { id:'oven', p:20 },
    { id:'fridge', p:15 },
    { id:'microwave', p:10 },
    { id:'bedlinen', p:5 }
];

const UPH = [
    { id:'sofa', p:50 },
    { id:'mattress', p:35 },
    { id:'armchair', p:20 },
    { id:'chair', p:10 }
];

let pTab = 'standard';

function renderPricingPage() {

    const tabs = document.getElementById('pricingTabs');
    const content = document.getElementById('pricingContent');

    if (!tabs || !content) return;

    tabs.innerHTML = SVCS.map(service => `
        <button 
            class="pricing-tab ${pTab === service.id ? 'active' : ''}" 
            data-s="${service.id}"
        >
            <span class="emoji">${service.emoji}</span>
            ${t('svc.' + service.id + '.n')}
        </button>
    `).join('');

    tabs
        .querySelectorAll('.pricing-tab')
        .forEach(button => {

            button.addEventListener('click', () => {
                pTab = button.dataset.s;
                renderPricingPage();
            });
        });

    let html = '';

    if (pTab === 'upholstery') {

        html += `
            <div class="pricing-table">

                <div class="pricing-row header">
                    <div class="desc">
                        ${t('pricing.uphItems')}
                    </div>

                    <div class="price-val">
                        ${t('price.from')}
                    </div>
                </div>

                ${UPH.map(item => `
                    <div class="pricing-row">

                        <div class="desc">
                            ${t('uph.' + item.id)}
                        </div>

                        <div class="price-val">
                            €${item.p}
                        </div>

                        <a 
                            class="book-row-btn"
                            href="/book?svc=upholstery&item=${item.id}"
                        >
                            ${t('services.book')} →
                        </a>

                    </div>
                `).join('')}

            </div>
        `;

    } else {

        const bp = BASE[pTab];
        const ex = SZ_EX[pTab];
        const w = WIN[pTab];

        html += `
            <div class="pricing-table">

                <div class="pricing-row header">
                    <div class="desc">
                        ${t('pricing.base')}
                    </div>

                    <div class="price-val">€</div>
                </div>

                ${SIZES.map(size => `
                    <div class="pricing-row">

                        <div class="desc">
                            ${t('size.' + size)}
                        </div>

                        <div class="price-val">
                            €${bp[size]}
                        </div>

                        <a 
                            class="book-row-btn"
                            href="/book?svc=${pTab}&size=${size}"
                        >
                            ${t('services.book')} →
                        </a>

                    </div>
                `).join('')}

            </div>
        `;

        html += `
            <div class="pricing-extras">

                <div class="pricing-extras-title">
                    ${t('pricing.extras')}
                </div>

                <div class="extras-grid">

                    <div class="extra-chip">
                        <span>${t('extra.balcony')}</span>

                        <span class="ep">
                            €${ex.balcony}
                        </span>
                    </div>

                    <div class="extra-chip">
                        <span>${t('extra.extrabath')}</span>

                        <span class="ep">
                            €${ex.extrabath}
                        </span>
                    </div>

                </div>

            </div>
        `;

        html += `
            <div class="pricing-extras" style="margin-top:20px">

                <div class="pricing-extras-title">
                    ${t('pricing.windows')}
                </div>

                <div class="extras-grid">

                    <div class="extra-chip">
                        <span>${t('extra.window')}</span>

                        <span class="ep">
                            €${w.window} / ${t('price.each')}
                        </span>
                    </div>

                    <div class="extra-chip">
                        <span>${t('extra.balcondoor')}</span>

                        <span class="ep">
                            €${w.balcondoor} / ${t('price.each')}
                        </span>
                    </div>

                </div>

            </div>
        `;

        html += `
            <div class="pricing-extras" style="margin-top:20px">

                <div class="pricing-extras-title">
                    ${t('pricing.household')}
                </div>

                <div class="extras-grid">

                    ${HOUSE.map(extra => `
                        <div class="extra-chip">

                            <span>
                                ${t('extra.' + extra.id)}
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

    content.innerHTML = html;
}

/* =========================
   HERO SLIDER
========================= */

const HERO_IMAGES = {

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

let heroIdx = 0;
let heroTimer = null;

function loadHeroImages() {

    const images =
        HERO_IMAGES[currentLang] ||
        HERO_IMAGES.en;

    document
        .querySelectorAll('.hero-slide')
        .forEach((element, index) => {

            element.src = images[index];
        });
}

function showHero(index) {

    heroIdx = index;

    document
        .querySelectorAll('.hero-slide')
        .forEach((element, i) => {

            element.classList.toggle(
                'active',
                i === index
            );
        });

    document
        .querySelectorAll('.hero-dot')
        .forEach((element, i) => {

            element.classList.toggle(
                'active',
                i === index
            );
        });
}

function nextHero() {
    showHero((heroIdx + 1) % 4);
}

function startHeroAuto() {

    clearInterval(heroTimer);

    heroTimer = setInterval(
        nextHero,
        3000
    );
}

document
    .querySelectorAll('.hero-dot')
    .forEach(dot => {

        dot.addEventListener('click', () => {

            showHero(
                parseInt(dot.dataset.d)
            );

            startHeroAuto();
        });
    });

/* =========================
   INIT
========================= */

applyLang();
loadHeroImages();
startHeroAuto();