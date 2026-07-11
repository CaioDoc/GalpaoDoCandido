/* ===================================================
   GALPÃO DO CÂNDIDO — Main JavaScript
   Hero Carousel | Product Grid | Tabs | Modal | WhatsApp
   =================================================== */

'use strict';

// ── Config ──────────────────────────────────────────
const WHATSAPP_NUMBER = '5519996146549';
const PAGE_SIZE = 8;

// ── State ────────────────────────────────────────────
let allProducts = [];
let featuredProducts = [];
let categories = [];
let currentCategory = 'Todos';
let catalogPage = 1;
let heroProducts = [];
let heroIndex = 0;
let heroTimer = null;

// Cart State
let quoteCart = [];

// ── Utils ────────────────────────────────────────────
function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function buildWhatsAppUrl(product) {
    const msg = `Olá! Gostaria de saber mais sobre *${product.title}* (Valor: ${formatPrice(product.price)}). Vi no catálogo do Galpão do Cândido.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function getFirstImage(product) {
    if (product.images && product.images.length > 0 && product.images[0] && !product.images[0].includes('demo-')) {
        return product.images[0];
    }
    return null;
}

function makePlaceholderSvg() {
    return `<div class="card-img-placeholder">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
    </svg>
  </div>`;
}

function waIconSvg(size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
}

// ── Data Fetching ─────────────────────────────────────
async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Falha ao carregar produtos');
        allProducts = await res.json();
        featuredProducts = allProducts.filter(p => p.featured);
        categories = ['Todos', ...new Set(allProducts.map(p => p.category))];
        return allProducts;
    } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        return [];
    }
}

// ── Hero Carousel ─────────────────────────────────────
function initHero() {
    heroProducts = featuredProducts.length > 0 ? featuredProducts : allProducts.slice(0, 5);
    if (heroProducts.length === 0) return;

    const slidesEl = document.getElementById('hero-slides');
    const dotsEl = document.getElementById('hero-dots');

    // Build slides
    slidesEl.innerHTML = heroProducts.map((p, i) => {
        const img = getFirstImage(p);
        const imgHtml = img
            ? `<img class="hero-slide-img" src="${img}" alt="${p.title}" loading="${i === 0 ? 'eager' : 'lazy'}">`
            : `<div class="hero-slide-placeholder"></div>`;
        return `<div class="hero-slide${i === 0 ? ' active' : ''}" data-index="${i}">${imgHtml}</div>`;
    }).join('');

    // Build dots
    dotsEl.innerHTML = heroProducts.map((_, i) =>
        `<button class="hero-dot${i === 0 ? ' active' : ''}" role="tab" aria-label="Slide ${i + 1}" aria-selected="${i === 0}" data-index="${i}"></button>`
    ).join('');

    updateHeroContent(0);

    // Dot clicks
    dotsEl.querySelectorAll('.hero-dot').forEach(dot => {
        dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.index)));
    });

    // Arrow clicks
    document.getElementById('hero-prev').addEventListener('click', () => {
        goToSlide((heroIndex - 1 + heroProducts.length) % heroProducts.length);
    });
    document.getElementById('hero-next').addEventListener('click', () => {
        goToSlide((heroIndex + 1) % heroProducts.length);
    });

    // Hero WhatsApp button
    document.getElementById('hero-whatsapp-btn').addEventListener('click', () => {
        window.open(buildWhatsAppUrl(heroProducts[heroIndex]), '_blank');
    });

    startHeroTimer();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');

    slides[heroIndex].classList.remove('active');
    dots[heroIndex].classList.remove('active');
    dots[heroIndex].setAttribute('aria-selected', 'false');

    heroIndex = index;

    slides[heroIndex].classList.add('active');
    dots[heroIndex].classList.add('active');
    dots[heroIndex].setAttribute('aria-selected', 'true');

    updateHeroContent(heroIndex);
    startHeroTimer();
}

function updateHeroContent(index) {
    const p = heroProducts[index];
    document.getElementById('hero-eyebrow').textContent = p.category;
    document.getElementById('hero-title').textContent = p.title;
    document.getElementById('hero-subtitle').textContent = p.subtitle || p.description?.substring(0, 100) + '...' || '';
    document.getElementById('hero-price').textContent = formatPrice(p.price);
}

function startHeroTimer() {
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => {
        goToSlide((heroIndex + 1) % heroProducts.length);
    }, 5000);
}

// ── Product Card Builder ──────────────────────────────
function buildProductCard(product) {
    const img = getFirstImage(product);
    const imgHtml = img
        ? `<img class="card-img" src="${img}" alt="${product.title}" loading="lazy">`
        : makePlaceholderSvg();

    const badgeHtml = product.featured
        ? `<span class="card-badge">Destaque</span>`
        : '';

    return `
    <article class="product-card" data-id="${product.id}" role="button" tabindex="0" aria-label="Ver ${product.title}">
      <div class="card-img-wrap">
        ${imgHtml}
        ${badgeHtml}
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <h3 class="card-title"><span class="card-title-inner">${product.title}</span></h3>
          <span class="card-price">${formatPrice(product.price)}</span>
        </div>
        <p class="card-subtitle">${product.subtitle || ''}</p>
        <button class="card-cta" data-id="${product.id}" aria-label="Chamar no WhatsApp sobre ${product.title}">
          ${waIconSvg(14)} Ver Detalhes
        </button>
      </div>
    </article>`;
}

// ── Novidades Grid ────────────────────────────────────
function renderNovidades() {
    const grid = document.getElementById('novidades-grid');
    const items = featuredProducts.length > 0
        ? featuredProducts.slice(0, 4)
        : allProducts.slice(0, 4);

    if (items.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-300);text-align:center;grid-column:1/-1;">Nenhum produto em destaque ainda.</p>';
        return;
    }

    grid.innerHTML = items.map(buildProductCard).join('');
    attachCardListeners(grid);
}

// ── Tabs & Catalog Grid ───────────────────────────────
function renderTabs() {
    const tabsList = document.getElementById('tabs-list');
    tabsList.innerHTML = categories.map((cat, i) =>
        `<button class="tab-btn${i === 0 ? ' active' : ''}" role="tab" data-category="${cat}" aria-selected="${i === 0}">${cat}</button>`
    ).join('');

    tabsList.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tabsList.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            currentCategory = btn.dataset.category;
            catalogPage = 1;
            renderCatalogGrid();
        });
    });
}

function getCatalogItems() {
    if (currentCategory === 'Todos') return allProducts;
    return allProducts.filter(p => p.category === currentCategory);
}

function renderCatalogGrid() {
    const grid = document.getElementById('catalogo-grid');
    const loadMoreRow = document.getElementById('load-more-row');
    const items = getCatalogItems();
    const sliced = items.slice(0, catalogPage * PAGE_SIZE);

    if (items.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-300);text-align:center;grid-column:1/-1;padding:2rem;">Nenhuma peça nesta categoria ainda.</p>';
        loadMoreRow.style.display = 'none';
        return;
    }

    grid.innerHTML = sliced.map(buildProductCard).join('');
    attachCardListeners(grid);

    if (sliced.length < items.length) {
        loadMoreRow.style.display = 'flex';
    } else {
        loadMoreRow.style.display = 'none';
    }
}

// ── Card Event Listeners ──────────────────────────────
function attachCardListeners(container) {
    // Open modal on card click
    container.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // If CTA was clicked, handle WA separately
            if (e.target.closest('.card-cta')) return;
            const id = card.dataset.id;
            openModal(id);
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!e.target.closest('.card-cta')) openModal(card.dataset.id);
            }
        });
    });

    // WhatsApp CTA on card
    container.querySelectorAll('.card-cta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const product = allProducts.find(p => p.id === btn.dataset.id);
            if (product) window.open(buildWhatsAppUrl(product), '_blank');
        });
    });
    // Scroll-reveal on long titles
    container.querySelectorAll('.card-title').forEach(titleEl => {
        const inner = titleEl.querySelector('.card-title-inner');
        if (!inner) return;
        titleEl.addEventListener('mouseenter', () => {
            const overflow = inner.scrollWidth - titleEl.clientWidth;
            if (overflow > 2) {
                titleEl.style.setProperty('--scroll-dist', `-${overflow}px`);
                titleEl.classList.add('scrolling');
            }
        });
        titleEl.addEventListener('mouseleave', () => {
            titleEl.classList.remove('scrolling');
        });
    });
}

// ── Modal ─────────────────────────────────────────────
function openModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const backdrop = document.getElementById('modal-backdrop');
    const mainImg = document.getElementById('modal-main-img');
    const thumbsEl = document.getElementById('modal-thumbs');

    // Populate
    document.getElementById('modal-category').textContent = product.category;
    document.getElementById('modal-product-title').textContent = product.title;
    document.getElementById('modal-subtitle').textContent = product.subtitle || '';
    document.getElementById('modal-description').textContent = product.description || '';
    document.getElementById('modal-price').textContent = formatPrice(product.price);

    // Images
    const validImages = (product.images || []).filter(img => img && !img.includes('demo-'));
    if (validImages.length > 0) {
        mainImg.src = validImages[0];
        mainImg.alt = product.title;
        mainImg.style.display = 'block';

        if (validImages.length > 1) {
            thumbsEl.innerHTML = validImages.map((src, i) =>
                `<div class="modal-thumb${i === 0 ? ' active' : ''}" data-index="${i}">
          <img src="${src}" alt="${product.title} foto ${i + 1}" loading="lazy">
        </div>`
            ).join('');

            thumbsEl.querySelectorAll('.modal-thumb').forEach(thumb => {
                thumb.addEventListener('click', () => {
                    thumbsEl.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                    const idx = parseInt(thumb.dataset.index);
                    mainImg.style.opacity = '0';
                    setTimeout(() => {
                        mainImg.src = validImages[idx];
                        mainImg.style.opacity = '1';
                    }, 150);
                });
            });
        } else {
            thumbsEl.innerHTML = '';
        }
    } else {
        mainImg.src = '';
        mainImg.alt = '';
        mainImg.style.display = 'none';
        thumbsEl.innerHTML = '';
    }

    // WhatsApp link
    document.getElementById('modal-whatsapp-btn').href = buildWhatsAppUrl(product);

    // Open
    backdrop.classList.add('open');
    backdrop.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';

    // Focus trap
    setTimeout(() => {
        document.getElementById('modal-close').focus();
    }, 300);
}

function closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function initModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ── Load More ─────────────────────────────────────────
function initLoadMore() {
    document.getElementById('load-more-btn').addEventListener('click', () => {
        catalogPage++;
        renderCatalogGrid();
    });
}

// ── Header scroll effect ──────────────────────────────
function initHeaderScroll() {
    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.style.background = 'rgba(10,10,10,0.98)';
        } else {
            header.style.background = 'rgba(10,10,10,0.92)';
        }
    }, { passive: true });
}

// ── Mobile Nav ────────────────────────────────────────
function initMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobile-nav');

    hamburger.addEventListener('click', () => {
        const isOpen = mobileNav.classList.toggle('open');
        hamburger.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', isOpen);
        mobileNav.setAttribute('aria-hidden', !isOpen);
    });

    // Close on link click
    mobileNav.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('open');
            hamburger.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
            mobileNav.setAttribute('aria-hidden', 'true');
        });
    });
}

// ── General WhatsApp contact buttons ─────────────────
function initContactButtons() {
    const genericMsg = 'Olá! Gostaria de conhecer as peças disponíveis no Galpão do Cândido.';
    const genericUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(genericMsg)}`;

    const headerCta = document.getElementById('header-whatsapp');
    if (headerCta) headerCta.href = genericUrl;

    const mobileWa = document.getElementById('mobile-whatsapp-nav');
    if (mobileWa) mobileWa.href = genericUrl;

    const contactWa = document.getElementById('contact-whatsapp');
    if (contactWa) {
        contactWa.href = genericUrl;
        contactWa.setAttribute('target', '_blank');
        contactWa.setAttribute('rel', 'noopener noreferrer');
    }
}

// ── Smooth scroll for anchor links ───────────────────
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 80; // header height
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

// ── CART DRAWER & QUOTE LOGIC ─────────────────────────
function initCart() {
    const cartBtn = document.getElementById('header-cart');
    const mobileCartBtn = document.getElementById('mobile-cart');
    const closeBtn = document.getElementById('cart-close');
    const overlay = document.getElementById('cart-drawer-backdrop');
    const addBtn = document.getElementById('modal-cart-btn');
    const checkoutWaBtn = document.getElementById('cart-checkout-whatsapp');

    // Load from local storage if exists
    try {
        const saved = localStorage.getItem('galpao_quote_cart');
        if (saved) {
            quoteCart = JSON.parse(saved);
        }
    } catch (e) { }

    updateCartUI();

    const openCart = () => overlay.classList.add('open');
    const closeCart = () => overlay.classList.remove('open');

    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (mobileCartBtn) {
        mobileCartBtn.addEventListener('click', () => {
            document.getElementById('mobile-nav').classList.remove('open');
            document.getElementById('hamburger').classList.remove('open');
            openCart();
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCart();
    });

    // Add to Quote from Modal
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const titleEl = document.getElementById('modal-product-title');
            if (!titleEl) return;

            const title = titleEl.textContent;
            const product = allProducts.find(p => p.title === title);
            if (product) {
                addToCart(product);
                closeModal();
                openCart();
            }
        });
    }

    if (checkoutWaBtn) {
        checkoutWaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sendQuoteToWhatsApp();
        });
    }
}

function addToCart(product) {
    if (!quoteCart.some(p => p.id === product.id)) {
        quoteCart.push(product);
        saveCart();
    }
}

function removeFromCart(id) {
    quoteCart = quoteCart.filter(p => p.id !== id);
    saveCart();
}

function saveCart() {
    localStorage.setItem('galpao_quote_cart', JSON.stringify(quoteCart));
    updateCartUI();
}

function updateCartUI() {
    const countBadge = document.getElementById('cart-count');
    const mobileCountBadge = document.getElementById('mobile-cart-count');
    const container = document.getElementById('cart-items-container');
    const totalPriceEl = document.getElementById('cart-total-price');
    const checkoutWaBtn = document.getElementById('cart-checkout-whatsapp');

    const count = quoteCart.length;
    if (countBadge) countBadge.textContent = count;
    if (mobileCountBadge) mobileCountBadge.textContent = count;

    if (count === 0) {
        if (container) container.innerHTML = '<p class="cart-empty-msg">Nenhuma peça adicionada ao orçamento.</p>';
        if (totalPriceEl) totalPriceEl.textContent = 'R$ 0,00';
        if (checkoutWaBtn) checkoutWaBtn.style.display = 'none';
        return;
    }

    let total = 0;
    let html = '';

    quoteCart.forEach(p => {
        total += p.price || 0;
        const img = getFirstImage(p);
        const imgHtml = img
            ? `<img class="cart-item-img" src="${img}" alt="${p.title}">`
            : `<div class="cart-item-img flex items-center justify-center bg-gray-100 text-gray-400"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;

        html += `
        <div class="cart-item">
            ${imgHtml}
            <div class="cart-item-info">
                <div class="cart-item-title">${p.title}</div>
                <div class="cart-item-price">${formatPrice(p.price)}</div>
                <button class="cart-item-remove" data-id="${p.id}">Remover</button>
            </div>
        </div>
        `;
    });

    if (container) container.innerHTML = html;
    if (totalPriceEl) totalPriceEl.textContent = formatPrice(total);
    if (checkoutWaBtn) checkoutWaBtn.style.display = 'flex';

    // Bind remove buttons
    container.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            removeFromCart(id);
        });
    });
}

function sendQuoteToWhatsApp() {
    if (quoteCart.length === 0) return;

    let msg = 'Olá! Gostaria de um orçamento para as seguintes peças do Galpão do Cândido:\n\n';
    let total = 0;

    quoteCart.forEach((p, idx) => {
        msg += `${idx + 1}. *${p.title}* - ${formatPrice(p.price)}\n`;
        total += p.price || 0;
    });

    msg += `\n*Valor Total Estimado:* ${formatPrice(total)}\n\nAguardo retorno. Obrigado!`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}


// ── App Init ──────────────────────────────────────────
async function init() {
    initHeaderScroll();
    initMobileNav();
    initModal();
    initCart();
    initLoadMore();
    initSmoothScroll();
    initContactButtons();

    await loadProducts();

    initHero();
    renderNovidades();
    renderTabs();
    renderCatalogGrid();
}

document.addEventListener('DOMContentLoaded', init);
