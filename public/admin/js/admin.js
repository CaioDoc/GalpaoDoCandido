/* ===================================================
   GALPÃO DO CÂNDIDO — Admin Panel JavaScript
   Auth Guard | Product CRUD | Category CRUD | Toast
   =================================================== */

'use strict';

// ── Auth Guard ─────────────────────────────────────────
async function checkAuth() {
    const defaultUser = { username: 'admin' };
    const usernameEl = document.getElementById('sidebar-username');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (usernameEl) usernameEl.textContent = defaultUser.username;
    if (avatarEl) avatarEl.textContent = defaultUser.username.charAt(0).toUpperCase();
    return defaultUser;
}

// ── Toast Notifications ────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icon = type === 'success' ? '✓' : '✕';
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── State ──────────────────────────────────────────────
let products = [];
let categories = [];
let editingId = null;
let pendingImages = [];
let deleteTargetId = null;
let currentPage = 'products';
let promoteTargetId = null;
let promotePollInterval = null;
let generalPromoteImagePath = null;
let generalPromotePollInterval = null;
let driveFiles = [];
let heroBanners = [];
let contactMessages = [];
let selectedContactId = null;
let contactSubjectFilter = 'ALL';

// ── Format price ───────────────────────────────────────
function formatPrice(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ── Navigation ─────────────────────────────────────────
function navigateTo(page) {
    currentPage = page;

    // Toggle pages
    document.getElementById('page-products').style.display = page === 'products' ? '' : 'none';
    document.getElementById('page-categories').style.display = page === 'categories' ? '' : 'none';
    document.getElementById('page-settings').style.display = page === 'settings' ? '' : 'none';
    document.getElementById('page-contacts').style.display = page === 'contacts' ? '' : 'none';

    // Toggle active nav links
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Update topbar title
    const titles = { products: 'Produtos', categories: 'Categorias', settings: 'Configurações', contacts: 'Mensagens & Contatos' };
    document.getElementById('topbar-title').textContent = titles[page] || '';

    // Render the right page
    if (page === 'categories') renderCategoriesPage();
    if (page === 'settings') loadSettings();
    if (page === 'contacts') loadContacts();
}

// ── Load Products ──────────────────────────────────────
async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        products = await res.json();
        renderTable();
        updateStats();
        populateCategoryFilter();
    } catch {
        showToast('Erro ao carregar produtos.', 'error');
    }
}

// ── Load Categories ────────────────────────────────────
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        categories = await res.json();
        populateCategorySelect();
        if (currentPage === 'categories') renderCategoriesPage();
    } catch {
        showToast('Erro ao carregar categorias.', 'error');
    }
}

// Populate the <select> in the product form
function populateCategorySelect() {
    const select = document.getElementById('f-category');
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione...</option>' +
        categories.map(c => `<option value="${c.name}"${c.name === currentVal ? ' selected' : ''}>${c.name}</option>`).join('');
}

// ── Stats ──────────────────────────────────────────────
function updateStats() {
    document.getElementById('stat-total').textContent = products.length;
    document.getElementById('stat-featured').textContent = products.filter(p => p.featured).length;
    document.getElementById('stat-categories').textContent = categories.length;
    document.getElementById('products-count').textContent = `${products.length} peça${products.length !== 1 ? 's' : ''} cadastrada${products.length !== 1 ? 's' : ''}`;
}

// ── Table Rendering ────────────────────────────────────
function getFilteredProducts() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const cat = document.getElementById('category-filter').value;
    return products.filter(p => {
        const matchSearch = !search ||
            p.title.toLowerCase().includes(search) ||
            (p.subtitle || '').toLowerCase().includes(search) ||
            (p.description || '').toLowerCase().includes(search);
        const matchCat = !cat || p.category === cat;
        return matchSearch && matchCat;
    });
}

function confirmDeleteProduct(id, title) {
    deleteTargetId = id;
    const msgEl = document.getElementById('confirm-msg');
    const dialogEl = document.getElementById('confirm-dialog');
    if (msgEl) msgEl.textContent = `"${title}" será removido permanentemente.`;
    if (dialogEl) dialogEl.classList.add('open');
}

let draggedProductId = null;

function setupTableDragAndDrop() {
    const tbody = document.getElementById('products-tbody');
    const mobileContainer = document.getElementById('products-mobile-cards');

    // Desktop Table Dragging
    if (tbody) {
        tbody.querySelectorAll('tr[data-id]').forEach(row => {
            row.setAttribute('draggable', 'true');

            row.addEventListener('dragstart', (e) => {
                draggedProductId = row.dataset.id;
                e.dataTransfer.effectAllowed = 'move';
                row.style.opacity = '0.4';
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.style.background = 'var(--dark-4)';
            });

            row.addEventListener('dragleave', () => {
                row.style.background = '';
            });

            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                row.style.background = '';
                const targetId = row.dataset.id;
                if (draggedProductId && draggedProductId !== targetId) {
                    reorderProductsArray(draggedProductId, targetId);
                }
            });

            row.addEventListener('dragend', () => {
                row.style.opacity = '1';
            });
        });
    }

    // Mobile Cards Dragging
    if (mobileContainer) {
        mobileContainer.querySelectorAll('.admin-product-card[data-id]').forEach(card => {
            card.setAttribute('draggable', 'true');

            card.addEventListener('dragstart', (e) => {
                draggedProductId = card.dataset.id;
                e.dataTransfer.effectAllowed = 'move';
                card.style.opacity = '0.4';
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                const targetId = card.dataset.id;
                if (draggedProductId && draggedProductId !== targetId) {
                    reorderProductsArray(draggedProductId, targetId);
                }
            });

            card.addEventListener('dragend', () => {
                card.style.opacity = '1';
            });
        });
    }
}

async function reorderProductsArray(fromId, toId) {
    const fromIndex = products.findIndex(p => p.id === fromId);
    const toIndex = products.findIndex(p => p.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = products.splice(fromIndex, 1);
    products.splice(toIndex, 0, moved);

    renderTable();

    // Persist new order to backend
    const items = products.map((p, idx) => ({ id: p.id, display_order: idx }));
    try {
        const res = await fetch('/api/products/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        if (res.ok) {
            showToast('Ordem dos produtos atualizada!');
        }
    } catch (err) {
        console.error('Erro ao reordenar produtos:', err);
    }
}

function renderTable() {
    const tbody = document.getElementById('products-tbody');
    const mobileContainer = document.getElementById('products-mobile-cards');
    const filtered = getFilteredProducts();

    const emptyMsg = products.length === 0 ? 'Nenhum produto cadastrado ainda. Adicione o primeiro!' : 'Nenhum produto encontrado com esses filtros.';

    if (filtered.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="table-empty">${emptyMsg}</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="table-empty" style="padding: 2rem; text-align: center; color: var(--gray-300);">${emptyMsg}</div>`;
        return;
    }

    if (tbody) {
        tbody.innerHTML = filtered.map(p => {
            const validImages = (p.images || []).filter(i => i && !i.includes('demo-'));
            const firstImg = validImages[0];
            const imgHtml = firstImg
                ? `<img class="table-img" src="${firstImg}" alt="${p.title}" loading="lazy">`
                : `<div class="table-img-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>`;

            return `
          <tr data-id="${p.id}">
            <td class="drag-handle" style="cursor: grab; text-align: center; font-size: 1.2rem; color: var(--gray-400);" title="Segure e arraste para reordenar">≡</td>
            <td>${imgHtml}</td>
            <td>
              <div class="table-title">${p.title}</div>
              ${p.subtitle ? `<div class="table-subtitle">${p.subtitle}</div>` : ''}
            </td>
            <td><span class="badge badge-category">${p.category}</span></td>
            <td class="table-price">${formatPrice(p.price)}</td>
            <td>${p.featured ? '<span class="badge badge-featured">★ Destaque</span>' : '<span style="color:var(--gray-400);font-size:0.8rem;">—</span>'}</td>
            <td>
              <div class="table-actions">
                <button class="btn btn-icon btn-sm promote-btn" data-id="${p.id}" title="Promover via WhatsApp" aria-label="Promover ${p.title}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </button>
                <button class="btn btn-icon btn-sm edit-btn" data-id="${p.id}" title="Editar" aria-label="Editar ${p.title}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}" data-title="${p.title}" title="Excluir" aria-label="Excluir ${p.title}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
        }).join('');

        tbody.querySelectorAll('.promote-btn').forEach(btn => {
            btn.addEventListener('click', () => openPromoteModal(btn.dataset.id));
        });
        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteProduct(btn.dataset.id, btn.dataset.title));
        });
    }

    if (mobileContainer) {
        mobileContainer.innerHTML = filtered.map(p => {
            const validImages = (p.images || []).filter(i => i && !i.includes('demo-'));
            const firstImg = validImages[0];
            const imgHtml = firstImg
                ? `<img class="admin-product-card-thumb" src="${firstImg}" alt="${p.title}">`
                : `<div class="admin-product-card-thumb flex items-center justify-center text-gray-400">🛋️</div>`;

            return `
            <div class="admin-product-card" data-id="${p.id}">
                <div class="admin-product-card-header">
                    <span class="drag-handle text-lg text-slate-400 cursor-grab px-1" title="Arraste para reordenar">≡</span>
                    ${imgHtml}
                    <div class="admin-product-card-info">
                        <div class="admin-product-card-title">${p.title}</div>
                        <div class="admin-product-card-meta">
                            <span class="badge badge-category">${p.category}</span>
                            ${p.featured ? '<span class="badge badge-featured">★ Destaque</span>' : ''}
                        </div>
                        <div class="admin-product-card-price" style="margin-top:0.3rem;">${formatPrice(p.price)}</div>
                    </div>
                </div>
                <div class="admin-product-card-actions">
                    <button class="btn btn-secondary btn-sm promote-btn" data-id="${p.id}">
                        📣 Promover
                    </button>
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${p.id}">
                        ✏️ Editar
                    </button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}" data-title="${p.title}">
                        🗑️ Excluir
                    </button>
                </div>
            </div>`;
        }).join('');

        mobileContainer.querySelectorAll('.promote-btn').forEach(btn => {
            btn.addEventListener('click', () => openPromoteModal(btn.dataset.id));
        });
        mobileContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
        mobileContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteProduct(btn.dataset.id, btn.dataset.title));
        });
    }

    setupTableDragAndDrop();
}

function populateCategoryFilter() {
    const select = document.getElementById('category-filter');
    const currentVal = select.value;
    const cats = [...new Set(products.map(p => p.category))].sort();
    select.innerHTML = '<option value="">Todas as categorias</option>' +
        cats.map(c => `<option value="${c}"${c === currentVal ? ' selected' : ''}>${c}</option>`).join('');
}

// ── Categories Page ────────────────────────────────────
function renderCategoriesPage() {
    const list = document.getElementById('cat-list');
    const countEl = document.getElementById('categories-count');

    countEl.textContent = `${categories.length} categoria${categories.length !== 1 ? 's' : ''} cadastrada${categories.length !== 1 ? 's' : ''}`;

    if (categories.length === 0) {
        list.innerHTML = '<p class="cat-empty">Nenhuma categoria cadastrada.</p>';
        return;
    }

    list.innerHTML = categories.map(cat => `
        <div class="cat-item" data-id="${cat.id}">
            <span class="cat-item-name">${cat.name}</span>
            <button class="cat-delete-btn" data-id="${cat.id}" data-name="${cat.name}" aria-label="Remover ${cat.name}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `).join('');

    list.querySelectorAll('.cat-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => removeCategory(parseInt(btn.dataset.id), btn.dataset.name));
    });
}

async function addCategory() {
    const input = document.getElementById('cat-name-input');
    const name = input.value.trim();
    if (!name) {
        showToast('Digite o nome da categoria.', 'error');
        input.focus();
        return;
    }

    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao adicionar.');

        input.value = '';
        showToast(`Categoria "${name}" adicionada!`);
        await loadCategories();
        updateStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function removeCategory(id, name) {
    try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao remover.');

        showToast(`Categoria "${name}" removida.`);
        await loadCategories();
        updateStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Settings (Hero Banners Slider Manager) ───────────────────────
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
            throw new Error(`Servidor respondeu com status ${res.status}`);
        }
        const settings = await res.json();
        
        if (settings.parsed_banners && Array.isArray(settings.parsed_banners)) {
            heroBanners = settings.parsed_banners;
        } else if (settings.hero_banners) {
            try {
                heroBanners = JSON.parse(settings.hero_banners);
            } catch (e) {
                heroBanners = [];
            }
        } else {
            heroBanners = [];
        }

        renderAdminHeroBanners();
    } catch (err) {
        console.error('Erro ao carregar configurações de banners:', err);
        showToast(`Erro ao carregar configurações: ${err.message}`, 'error');
    }
}

function renderAdminHeroBanners() {
    const listEl = document.getElementById('hero-banners-admin-list');
    if (!listEl) return;

    if (!heroBanners || heroBanners.length === 0) {
        listEl.innerHTML = `
        <div style="text-align:center; padding: 2rem; background: var(--dark-2); border: 1px dashed var(--dark-4); border-radius: 8px;">
            <p style="color: var(--gray-300); margin-bottom: 0.75rem; font-size: 0.9rem;">Nenhum banner personalizado configurado ainda.</p>
            <button type="button" class="btn btn-secondary" onclick="addHeroBanner()" style="background: rgba(124, 77, 255, 0.15); color: #a485ff; border: 1px solid rgba(124, 77, 255, 0.3); font-size: 0.8rem;">
                ➕ Criar Primeiro Banner
            </button>
        </div>`;
        return;
    }

    listEl.innerHTML = heroBanners.map((banner, bIdx) => {
        const buttonsHtml = (banner.buttons || []).map((btn, btnIdx) => `
            <div class="banner-btn-item" style="display: flex; gap: 0.5rem; align-items: center; background: var(--dark-2); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--dark-4); flex-wrap: wrap;">
                <div style="flex: 2; min-width: 130px;">
                    <label style="font-size: 0.65rem; color: var(--gray-400); display: block;">Texto do Botão</label>
                    <input type="text" class="form-input btn-text-input" data-bidx="${bIdx}" data-btnidx="${btnIdx}" value="${btn.text || ''}" placeholder="Ex: Explorar Catálogo" style="font-size: 0.75rem; padding: 0.3rem 0.5rem;" />
                </div>
                <div style="flex: 1.5; min-width: 120px;">
                    <label style="font-size: 0.65rem; color: var(--gray-400); display: block;">Estilo do Botão</label>
                    <select class="form-input form-select btn-type-select" data-bidx="${bIdx}" data-btnidx="${btnIdx}" style="font-size: 0.75rem; padding: 0.3rem 0.5rem;">
                        <option value="default" ${btn.type === 'default' ? 'selected' : ''}>Default (Amarelo)</option>
                        <option value="secondary" ${btn.type === 'secondary' ? 'selected' : ''}>Secondary (Transparente)</option>
                    </select>
                </div>
                <div style="flex: 2; min-width: 140px;">
                    <label style="font-size: 0.65rem; color: var(--gray-400); display: block;">Link de Destino</label>
                    <input type="text" class="form-input btn-link-input" data-bidx="${bIdx}" data-btnidx="${btnIdx}" value="${btn.link || ''}" placeholder="Ex: #catalogo ou https://..." style="font-size: 0.75rem; padding: 0.3rem 0.5rem;" />
                </div>
                <button type="button" class="btn-remove-action-btn" data-bidx="${bIdx}" data-btnidx="${btnIdx}" style="background: rgba(231, 76, 60, 0.15); color: var(--red-light); border: 1px solid rgba(231, 76, 60, 0.3); padding: 0.35rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-top: 0.8rem;" title="Remover Botão">
                    🗑️
                </button>
            </div>
        `).join('');

        const previewImg = banner.imageUrl 
            ? `<img src="${banner.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<span style="font-size: 0.75rem; color: var(--gray-400);">Sem imagem</span>`;

        return `
        <div class="hero-banner-admin-card" data-bidx="${bIdx}" style="background: var(--dark-2); border: 1px solid var(--dark-4); border-radius: 8px; padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--dark-4); padding-bottom: 0.6rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: var(--purple-light);">
                    Banner #${bIdx + 1} — ${banner.title ? banner.title.substring(0, 30) : 'Sem título'}
                </span>
                <button type="button" class="btn-delete-banner-slide" data-bidx="${bIdx}" style="background: rgba(231, 76, 60, 0.15); color: var(--red-light); border: 1px solid rgba(231, 76, 60, 0.3); font-size: 0.75rem; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.2rem;">
                    🗑️ Deletar Banner
                </button>
            </div>

            <!-- Content Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
                <!-- Image Section -->
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--gray-300);">Imagem de Fundo (16:9)</label>
                    <div style="width: 100%; aspect-ratio: 16/9; background: var(--dark-4); border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                        ${previewImg}
                    </div>
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                        <input type="text" class="form-input banner-img-url-input" data-bidx="${bIdx}" value="${banner.imageUrl || ''}" placeholder="URL da imagem (http...)" style="font-size: 0.75rem; padding: 0.35rem 0.5rem; flex: 1;" />
                        <label class="btn btn-secondary" style="font-size: 0.7rem; padding: 0.35rem 0.6rem; cursor: pointer; margin: 0; white-space: nowrap;">
                            📁 Upload
                            <input type="file" class="banner-file-upload-input" data-bidx="${bIdx}" accept="image/*" style="display:none;" />
                        </label>
                    </div>
                </div>

                <!-- Text Fields Section -->
                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--gray-300);">Tag (Eyebrow)</label>
                        <input type="text" class="form-input banner-tag-input" data-bidx="${bIdx}" value="${banner.tag || ''}" placeholder="Ex: COLEÇÃO EXCLUSIVA" style="font-size: 0.8rem; padding: 0.4rem 0.6rem;" />
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--gray-300);">Título Principal</label>
                        <input type="text" class="form-input banner-title-input" data-bidx="${bIdx}" value="${banner.title || ''}" placeholder="Ex: Móveis de Luxo & Design Atemporal" style="font-size: 0.8rem; padding: 0.4rem 0.6rem;" />
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--gray-300);">Subtítulo / Descrição</label>
                        <textarea class="form-textarea banner-subtitle-input" data-bidx="${bIdx}" placeholder="Ex: Transforme seu ambiente com a sofisticação de peças selecionadas à mão." style="font-size: 0.8rem; padding: 0.4rem 0.6rem; height: 60px; min-height: 60px;">${banner.subtitle || ''}</textarea>
                    </div>
                </div>
            </div>

            <!-- Buttons Section -->
            <div style="background: var(--dark-3); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--dark-4);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--gray-200);">Botões de Ação</span>
                    <button type="button" class="btn-add-action-btn" data-bidx="${bIdx}" style="background: rgba(124, 77, 255, 0.15); color: #a485ff; border: 1px solid rgba(124, 77, 255, 0.3); font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">
                        ➕ Adicionar Botão
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${buttonsHtml || '<p style="font-size: 0.75rem; color: var(--gray-400); margin: 0;">Nenhum botão adicionado a este banner.</p>'}
                </div>
            </div>
        </div>
        `;
    }).join('');

    attachAdminHeroBannersListeners();
}

function attachAdminHeroBannersListeners() {
    const listEl = document.getElementById('hero-banners-admin-list');
    if (!listEl) return;

    listEl.querySelectorAll('.banner-tag-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            if (heroBanners[bIdx]) heroBanners[bIdx].tag = e.target.value;
        });
    });

    listEl.querySelectorAll('.banner-title-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            if (heroBanners[bIdx]) heroBanners[bIdx].title = e.target.value;
        });
    });

    listEl.querySelectorAll('.banner-subtitle-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            if (heroBanners[bIdx]) heroBanners[bIdx].subtitle = e.target.value;
        });
    });

    listEl.querySelectorAll('.banner-img-url-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            if (heroBanners[bIdx]) {
                heroBanners[bIdx].imageUrl = e.target.value;
                const card = e.target.closest('.hero-banner-admin-card');
                const previewContainer = card.querySelector('div[style*="aspect-ratio"]');
                if (previewContainer) {
                    previewContainer.innerHTML = e.target.value 
                        ? `<img src="${e.target.value}" style="width: 100%; height: 100%; object-fit: cover;" />`
                        : `<span style="font-size: 0.75rem; color: var(--gray-400);">Sem imagem</span>`;
                }
            }
        });
    });

    listEl.querySelectorAll('.banner-file-upload-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            const file = e.target.files[0];
            if (!file) return;

            try {
                showToast('Enviando imagem do banner...');
                const formData = new FormData();
                formData.append('image', file);

                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Erro no upload');

                const { url } = await res.json();
                if (heroBanners[bIdx]) {
                    heroBanners[bIdx].imageUrl = url;
                    renderAdminHeroBanners();
                    showToast('Imagem do banner atualizada!');
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    listEl.querySelectorAll('.btn-delete-banner-slide').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bIdx = parseInt(btn.dataset.bidx);
            heroBanners.splice(bIdx, 1);
            renderAdminHeroBanners();
        });
    });

    listEl.querySelectorAll('.btn-text-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            const btnIdx = parseInt(e.target.dataset.btnidx);
            if (heroBanners[bIdx] && heroBanners[bIdx].buttons[btnIdx]) {
                heroBanners[bIdx].buttons[btnIdx].text = e.target.value;
            }
        });
    });

    listEl.querySelectorAll('.btn-type-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            const btnIdx = parseInt(e.target.dataset.btnidx);
            if (heroBanners[bIdx] && heroBanners[bIdx].buttons[btnIdx]) {
                heroBanners[bIdx].buttons[btnIdx].type = e.target.value;
            }
        });
    });

    listEl.querySelectorAll('.btn-link-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const bIdx = parseInt(e.target.dataset.bidx);
            const btnIdx = parseInt(e.target.dataset.btnidx);
            if (heroBanners[bIdx] && heroBanners[bIdx].buttons[btnIdx]) {
                heroBanners[bIdx].buttons[btnIdx].link = e.target.value;
            }
        });
    });

    listEl.querySelectorAll('.btn-remove-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bIdx = parseInt(btn.dataset.bidx);
            const btnIdx = parseInt(btn.dataset.btnidx);
            if (heroBanners[bIdx] && heroBanners[bIdx].buttons) {
                heroBanners[bIdx].buttons.splice(btnIdx, 1);
                renderAdminHeroBanners();
            }
        });
    });

    listEl.querySelectorAll('.btn-add-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bIdx = parseInt(btn.dataset.bidx);
            if (heroBanners[bIdx]) {
                if (!heroBanners[bIdx].buttons) heroBanners[bIdx].buttons = [];
                heroBanners[bIdx].buttons.push({
                    text: 'Novo Botão',
                    type: 'default',
                    link: '#catalogo'
                });
                renderAdminHeroBanners();
            }
        });
    });
}

function addHeroBanner() {
    heroBanners.push({
        id: 'banner-' + Date.now(),
        tag: 'NOVA COLEÇÃO',
        title: 'Móveis de Luxo & Design Atemporal',
        subtitle: 'Transforme seu ambiente com a sofisticação de peças selecionadas à mão.',
        imageUrl: '',
        buttons: [
            { text: 'Explorar Catálogo', type: 'default', link: '#catalogo' },
            { text: 'Falar com Vendedor', type: 'secondary', link: 'https://wa.me/5519996146549' }
        ]
    });
    renderAdminHeroBanners();
}

async function saveHeroBanners() {
    const btn = document.getElementById('btn-save-hero-banners');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/settings/hero-banners', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banners: heroBanners })
        });

        if (!res.ok) throw new Error('Erro ao salvar banners.');

        showToast('Banners principais salvos com sucesso!');
        loadSettings();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

window.addHeroBanner = addHeroBanner;
window.saveHeroBanners = saveHeroBanners;

// ── Contact Messages Platform ──────────────────────────
async function loadContacts() {
    try {
        const res = await fetch('/api/contacts');
        if (!res.ok) throw new Error('Erro ao carregar mensagens.');
        const data = await res.json();

        if (data.success) {
            contactMessages = data.messages || [];
            updateUnreadBadge(data.unreadCount || 0);
            renderContactsList();
        }
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar mensagens de contato.', 'error');
    }
}

function updateUnreadBadge(count) {
    const badge = document.getElementById('unread-messages-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderContactsList() {
    const container = document.getElementById('contacts-list-container');
    const searchVal = document.getElementById('contact-search-input')?.value.toLowerCase().trim() || '';

    if (!container) return;

    let filtered = [...contactMessages];

    // Subject Filter
    if (contactSubjectFilter === 'UNREAD') {
        filtered = filtered.filter(m => m.status === 'unread');
    } else if (contactSubjectFilter !== 'ALL') {
        filtered = filtered.filter(m => m.subject === contactSubjectFilter);
    }

    // Search Filter
    if (searchVal) {
        filtered = filtered.filter(m => 
            m.name.toLowerCase().includes(searchVal) || 
            m.email.toLowerCase().includes(searchVal) ||
            m.message.toLowerCase().includes(searchVal)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; background: var(--dark-3); border: 1px dashed var(--dark-4); border-radius: 8px; color: var(--gray-300);">
            <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">📬</span>
            <p style="margin: 0; font-size: 0.9rem;">Nenhuma mensagem encontrada para os filtros selecionados.</p>
        </div>`;
        return;
    }

    container.innerHTML = filtered.map(msg => {
        const isUnread = msg.status === 'unread';
        const isReplied = msg.status === 'replied';
        
        let subjectBadgeClass = 'background: rgba(124,77,255,0.15); color: #a485ff; border: 1px solid rgba(124,77,255,0.3);';
        if (msg.subject === 'Venda') subjectBadgeClass = 'background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3);';
        if (msg.subject === 'Compra') subjectBadgeClass = 'background: rgba(241, 196, 15, 0.15); color: #f1c40f; border: 1px solid rgba(241, 196, 15, 0.3);';

        const statusBadge = isReplied 
            ? `<span style="font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3);">✓ Respondido</span>`
            : isUnread
                ? `<span style="font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: rgba(230, 126, 34, 0.15); color: #e67e22; border: 1px solid rgba(230, 126, 34, 0.3);">⚡ Não lida</span>`
                : `<span style="font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: var(--dark-4); color: var(--gray-400);">Lida</span>`;

        const imageHtml = msg.image_url ? `
            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--dark-4);">
                <span style="font-size: 0.7rem; font-weight: 600; color: var(--gray-400); display: block; margin-bottom: 0.4rem;">Foto Anexada pelo Cliente:</span>
                <a href="${msg.image_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block;">
                    <img src="${msg.image_url}" alt="Anexo" style="max-height: 120px; max-width: 100%; border-radius: 6px; border: 1px solid var(--dark-4); object-fit: cover;" />
                </a>
            </div>
        ` : '';

        const replyBoxHtml = msg.reply_message ? `
            <div style="margin-top: 0.75rem; background: rgba(46, 204, 113, 0.08); border: 1px solid rgba(46, 204, 113, 0.2); border-radius: 6px; padding: 0.6rem 0.8rem; font-size: 0.75rem; color: var(--gray-200);">
                <strong style="color: #2ecc71; display: block; margin-bottom: 0.2rem;">Sua Resposta:</strong>
                ${msg.reply_message}
            </div>
        ` : '';

        const formattedDate = msg.created_at ? new Date(msg.created_at).toLocaleString('pt-BR') : '';

        return `
        <div class="contact-card" data-id="${msg.id}" style="background: var(--dark-3); border: 1px solid ${isUnread ? 'rgba(244,140,37,0.4)' : 'var(--dark-4)'}; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <span style="font-weight: 700; font-size: 0.95rem; color: var(--white-pure);">${msg.name}</span>
                    <span style="font-size: 0.8rem; color: var(--gray-400); margin-left: 0.5rem;">&lt;${msg.email}&gt;</span>
                </div>
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                    <span style="font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; ${subjectBadgeClass}">${msg.subject}</span>
                    ${statusBadge}
                    <span style="font-size: 0.7rem; color: var(--gray-400); margin-left: 0.4rem;">${formattedDate}</span>
                </div>
            </div>

            <div style="font-size: 0.85rem; color: var(--gray-200); line-height: 1.5; white-space: pre-wrap; background: var(--dark-2); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--dark-4);">
                ${msg.message}
            </div>

            ${imageHtml}
            ${replyBoxHtml}

            <!-- Actions Bar -->
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.4rem; border-top: 1px solid var(--dark-4); padding-top: 0.6rem;">
                <button type="button" class="btn btn-secondary btn-reply-contact" data-id="${msg.id}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; background: rgba(124, 77, 255, 0.15); color: #a485ff; border: 1px solid rgba(124, 77, 255, 0.3); display: flex; align-items: center; gap: 0.3rem;">
                    💬 Responder
                </button>
                <button type="button" class="btn btn-secondary btn-delete-contact" data-id="${msg.id}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem; background: rgba(231, 76, 60, 0.15); color: var(--red-light); border: 1px solid rgba(231, 76, 60, 0.3); display: flex; align-items: center; gap: 0.3rem;">
                    🗑️ Excluir
                </button>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-reply-contact').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            openReplyModal(id);
        });
    });

    container.querySelectorAll('.btn-delete-contact').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
                await deleteContactMessage(id);
            }
        });
    });
}

function openReplyModal(id) {
    const msg = contactMessages.find(m => m.id === id);
    if (!msg) return;

    selectedContactId = id;

    const modal = document.getElementById('reply-modal');
    const summary = document.getElementById('reply-customer-summary');
    const replyInput = document.getElementById('reply-message-input');
    const waBtn = document.getElementById('reply-btn-wa');
    const emailBtn = document.getElementById('reply-btn-email');

    if (summary) {
        summary.innerHTML = `
            <strong>Cliente:</strong> ${msg.name} (${msg.email})<br>
            <strong>Assunto:</strong> ${msg.subject}<br>
            <strong>Mensagem:</strong> "${msg.message.substring(0, 120)}${msg.message.length > 120 ? '...' : ''}"
        `;
    }

    if (replyInput) replyInput.value = msg.reply_message || '';

    const defaultReplyMsg = `Olá ${msg.name}, referente ao seu contato sobre [${msg.subject}] no Galpão do Cândido: `;
    const encodedMsg = encodeURIComponent(defaultReplyMsg);

    if (waBtn) waBtn.href = `https://wa.me/5519996146549?text=${encodedMsg}`;
    if (emailBtn) emailBtn.href = `mailto:${msg.email}?subject=${encodeURIComponent('Resposta: ' + msg.subject + ' — Galpão do Cândido')}&body=${encodedMsg}`;

    if (modal) modal.style.display = 'flex';
}

function closeReplyModal() {
    const modal = document.getElementById('reply-modal');
    if (modal) modal.style.display = 'none';
    selectedContactId = null;
}

async function saveReply() {
    if (!selectedContactId) return;

    const replyInput = document.getElementById('reply-message-input');
    const replyMessage = replyInput?.value.trim() || 'Respondido via atendimento direto';

    try {
        const res = await fetch(`/api/contacts/${selectedContactId}/reply`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replyMessage })
        });

        if (!res.ok) throw new Error('Erro ao salvar resposta');

        showToast('Resposta registrada com sucesso!');
        closeReplyModal();
        loadContacts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteContactMessage(id) {
    try {
        const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao excluir mensagem');

        showToast('Mensagem excluída.');
        loadContacts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.closeReplyModal = closeReplyModal;

// ── Modal ──────────────────────────────────────────────
function openAddModal() {
    editingId = null;
    pendingImages = [];
    document.getElementById('modal-title').textContent = 'Novo Produto';
    document.getElementById('save-text').textContent = 'Salvar Produto';
    document.getElementById('product-form').reset();
    populateCategorySelect();
    document.getElementById('upload-previews').innerHTML = '';
    document.getElementById('upload-error').style.display = 'none';
    document.getElementById('product-modal').classList.add('open');
    document.getElementById('f-title').focus();
}

function openEditModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    editingId = id;
    const validImages = (product.images || []).filter(i => i && !i.includes('demo-'));
    pendingImages = [...validImages];

    document.getElementById('modal-title').textContent = 'Editar Produto';
    document.getElementById('save-text').textContent = 'Salvar Alterações';

    document.getElementById('f-title').value = product.title;
    document.getElementById('f-subtitle').value = product.subtitle || '';
    document.getElementById('f-price').value = product.price;
    document.getElementById('f-description').value = product.description || '';
    document.getElementById('f-featured').checked = !!product.featured;

    populateCategorySelect();
    document.getElementById('f-category').value = product.category;

    renderPreviews();
    document.getElementById('upload-error').style.display = 'none';
    document.getElementById('product-modal').classList.add('open');
    document.getElementById('f-title').focus();
}

function closeModal() {
    document.getElementById('product-modal').classList.remove('open');
    editingId = null;
    pendingImages = [];
}

async function checkWhatsAppStatus() {
    const statusBadge = document.getElementById('promote-whatsapp-badge');
    const qrInstructions = document.getElementById('promote-qr-instructions');
    const qrContainer = document.getElementById('promote-qr-container');
    const qrImg = document.getElementById('promote-qr-img');
    const qrLoading = document.getElementById('promote-qr-loading');
    const submitBtn = document.getElementById('promote-submit');

    if (!statusBadge) return;

    try {
        const res = await fetch('/api/promote/whatsapp-status');
        if (res.ok) {
            const data = await res.json(); // { status, qrCode, ready }
            
            if (data.ready || data.status === 'connected') {
                statusBadge.textContent = 'Conectado ✓';
                statusBadge.style.background = 'rgba(39, 174, 96, 0.15)';
                statusBadge.style.color = 'var(--green)';
                statusBadge.style.borderColor = 'rgba(39, 174, 96, 0.25)';
                
                qrInstructions.style.display = 'none';
                if (submitBtn) submitBtn.disabled = false;
            } else {
                statusBadge.textContent = data.status === 'connecting' ? 'Conectando...' : 'Desconectado ✕';
                statusBadge.style.background = data.status === 'connecting' ? 'rgba(230, 126, 34, 0.15)' : 'rgba(192, 57, 43, 0.15)';
                statusBadge.style.color = data.status === 'connecting' ? 'var(--orange)' : 'var(--red-light)';
                statusBadge.style.borderColor = data.status === 'connecting' ? 'rgba(230, 126, 34, 0.25)' : 'rgba(192, 57, 43, 0.25)';
                
                qrInstructions.style.display = 'block';
                
                if (data.qrCode) {
                    qrContainer.style.display = 'inline-block';
                    qrImg.src = data.qrCode;
                    qrLoading.style.display = 'none';
                } else {
                    qrContainer.style.display = 'none';
                    qrImg.src = '';
                    qrLoading.style.display = 'block';
                }
                
                if (submitBtn) submitBtn.disabled = true;
            }
        } else {
            throw new Error();
        }
    } catch {
        statusBadge.textContent = 'Erro ao verificar ✕';
        statusBadge.style.background = 'rgba(192, 57, 43, 0.15)';
        statusBadge.style.color = 'var(--red-light)';
        statusBadge.style.borderColor = 'rgba(192, 57, 43, 0.25)';
    }
}

async function openPromoteModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    promoteTargetId = id;
    
    // Fill product preview details
    document.getElementById('promote-prod-title').textContent = product.title;
    document.getElementById('promote-prod-subtitle').textContent = product.subtitle || '';
    document.getElementById('promote-prod-price').textContent = formatPrice(product.price);
    
    const validImages = (product.images || []).filter(img => img && !img.includes('demo-'));
    const imgEl = document.getElementById('promote-prod-img');
    if (validImages.length > 0) {
        imgEl.src = validImages[0];
        imgEl.style.display = 'block';
    } else {
        imgEl.src = '';
        imgEl.style.display = 'none';
    }

    // Reset Form
    document.getElementById('promote-form').reset();

    // Check status immediately
    await checkWhatsAppStatus();

    // Start polling status every 3 seconds
    if (promotePollInterval) clearInterval(promotePollInterval);
    promotePollInterval = setInterval(checkWhatsAppStatus, 3000);

    // Show modal
    const promoteModal = document.getElementById('promote-modal');
    promoteModal.classList.add('open');
    promoteModal.style.display = 'flex';
    document.getElementById('p-phone').focus();
}

function closePromoteModal() {
    const promoteModal = document.getElementById('promote-modal');
    promoteModal.classList.remove('open');
    promoteModal.style.display = 'none';
    promoteTargetId = null;
    
    if (promotePollInterval) {
        clearInterval(promotePollInterval);
        promotePollInterval = null;
    }
}

async function generatePromoteMessageWithAi() {
    if (!promoteTargetId) return;

    const discount = document.getElementById('p-discount').value;
    const tone = document.getElementById('p-tone').value;

    const genBtn = document.getElementById('promote-ai-generate-btn');
    const spinner = genBtn.querySelector('.promote-ai-spinner');
    
    genBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    try {
        const res = await fetch('/api/promote/generate-message', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId: promoteTargetId,
                discount,
                tone
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Erro ao gerar mensagem.');
        }

        const msgTextarea = document.getElementById('p-message');
        if (msgTextarea) {
            msgTextarea.value = data.message;
        }
        showToast('Mensagem gerada com sucesso! Edite se necessário.');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        genBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

async function handlePromoteSubmit(e) {
    e.preventDefault();

    if (!promoteTargetId) return;

    const phoneInput = document.getElementById('p-phone');
    const groupLinkInput = document.getElementById('p-group-link');
    const messageInput = document.getElementById('p-message');
    const scheduleDateInput = document.getElementById('p-schedule-date');
    const scheduleTimeInput = document.getElementById('p-schedule-time');

    const phone = phoneInput.value.trim();
    const groupLink = groupLinkInput.value.trim();
    const mensagem = messageInput.value.trim();
    const scheduleDate = scheduleDateInput ? scheduleDateInput.value : '';
    const scheduleTime = scheduleTimeInput ? scheduleTimeInput.value : '';

    if (!phone && !groupLink) {
        showToast('Informe o WhatsApp do Cliente OU o Link do Grupo do WhatsApp.', 'error');
        phoneInput.focus();
        return;
    }

    if (phone && groupLink) {
        showToast('Informe apenas um canal: WhatsApp do Cliente OU Link de Grupo, não ambos.', 'error');
        return;
    }

    let cleanPhone = null;
    if (phone) {
        cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            showToast('Por favor, insira um número de WhatsApp válido com DDD.', 'error');
            phoneInput.focus();
            return;
        }
    }

    if (groupLink) {
        if (!groupLink.includes('chat.whatsapp.com/')) {
            showToast('Por favor, insira um link de convite do WhatsApp válido (chat.whatsapp.com/...).', 'error');
            groupLinkInput.focus();
            return;
        }
    }

    if ((scheduleDate && !scheduleTime) || (!scheduleDate && scheduleTime)) {
        showToast('Para agendar o envio, preencha a data E a hora.', 'error');
        if (!scheduleDate) scheduleDateInput.focus();
        else scheduleTimeInput.focus();
        return;
    }

    if (scheduleDate && scheduleTime) {
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        if (scheduledDateTime <= new Date()) {
            showToast('A data e hora do agendamento devem ser no futuro.', 'error');
            scheduleTimeInput.focus();
            return;
        }
    }

    if (!mensagem) {
        showToast('A mensagem a ser enviada é obrigatória. Digite ou use a IA para gerar.', 'error');
        messageInput.focus();
        return;
    }

    const submitBtn = document.getElementById('promote-submit');
    const spinner = submitBtn.querySelector('.promote-spinner');
    const textSpan = submitBtn.querySelector('span');

    const isScheduled = !!(scheduleDate && scheduleTime);
    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    textSpan.textContent = isScheduled ? 'Agendando...' : 'Enviando...';

    try {
        const res = await fetch('/api/promote/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: promoteTargetId,
                phone: cleanPhone,
                groupLink: groupLink || null,
                mensagem,
                scheduleDate: scheduleDate || null,
                scheduleTime: scheduleTime || null
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Erro ao enviar a promoção.');
        }

        if (data.scheduled) {
            showToast(data.message || 'Promoção agendada com sucesso!');
        } else {
            showToast('Promoção enviada via WhatsApp com sucesso!');
        }
        closePromoteModal();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        textSpan.textContent = 'Enviar 🚀';
    }
}

// ── General Promote Modal ──────────────────────────────
async function checkGeneralWhatsAppStatus() {
    const statusBadge = document.getElementById('gp-promote-whatsapp-badge');
    const submitBtn = document.getElementById('gp-promote-submit');

    if (!statusBadge) return;

    try {
        const res = await fetch('/api/promote/whatsapp-status');
        if (res.ok) {
            const data = await res.json(); // { status, qrCode, ready }
            
            if (data.ready || data.status === 'connected') {
                statusBadge.textContent = 'Conectado ✓';
                statusBadge.style.background = 'rgba(39, 174, 96, 0.15)';
                statusBadge.style.color = 'var(--green)';
                statusBadge.style.borderColor = 'rgba(39, 174, 96, 0.25)';
                if (submitBtn) submitBtn.disabled = false;
            } else {
                statusBadge.textContent = data.status === 'connecting' ? 'Conectando...' : 'Desconectado ✕';
                statusBadge.style.background = data.status === 'connecting' ? 'rgba(230, 126, 34, 0.15)' : 'rgba(192, 57, 43, 0.15)';
                statusBadge.style.color = data.status === 'connecting' ? 'var(--orange)' : 'var(--red-light)';
                statusBadge.style.borderColor = data.status === 'connecting' ? 'rgba(230, 126, 34, 0.25)' : 'rgba(192, 57, 43, 0.25)';
                
                // For general promotion, since there's no nested QR container (it shares connection), we just disable submit if disconnected
                if (submitBtn) submitBtn.disabled = true;
            }
        }
    } catch {
        statusBadge.textContent = 'Erro ao verificar ✕';
        statusBadge.style.background = 'rgba(192, 57, 43, 0.15)';
        statusBadge.style.color = 'var(--red-light)';
        statusBadge.style.borderColor = 'rgba(192, 57, 43, 0.25)';
        if (submitBtn) submitBtn.disabled = true;
    }
}

async function openGeneralPromoteModal() {
    // Reset Form
    document.getElementById('gp-promote-form').reset();
    
    // Clear image state
    generalPromoteImagePath = null;
    const previewImg = document.getElementById('promocao-geral-imagem-preview') || document.getElementById('gp-image-preview-img');
    const previewEmpty = document.getElementById('promocao-geral-placeholder') || document.getElementById('promocao-geral-imagem-placeholder') || document.getElementById('gp-image-preview-empty');
    if (previewImg) previewImg.style.display = 'none';
    if (previewEmpty) previewEmpty.style.display = 'block';

    // Check status immediately
    await checkGeneralWhatsAppStatus();

    // Start polling status every 3 seconds
    if (generalPromotePollInterval) clearInterval(generalPromotePollInterval);
    generalPromotePollInterval = setInterval(checkGeneralWhatsAppStatus, 3000);

    // Show modal
    const generalModal = document.getElementById('general-promote-modal');
    generalModal.classList.add('open');
    generalModal.style.display = 'flex';
    document.getElementById('gp-phone').focus();
}

function closeGeneralPromoteModal() {
    const generalModal = document.getElementById('general-promote-modal');
    generalModal.classList.remove('open');
    generalModal.style.display = 'none';
    generalPromoteImagePath = null;
    
    if (generalPromotePollInterval) {
        clearInterval(generalPromotePollInterval);
        generalPromotePollInterval = null;
    }
}

function generateGeneralPromoteImage() {
  const promptInput = document.querySelector('#promocao-geral-prompt');
  const prompt = promptInput ? promptInput.value.trim() : '';
  
  if (!prompt) {
    alert('Digite uma descrição para a imagem');
    return;
  }

  const generateBtn = document.querySelector('#btn-gerar-imagem-ia');
  const originalText = generateBtn.innerHTML;
  generateBtn.innerHTML = '⏳ Gerando...';
  generateBtn.disabled = true;

  // Esconder placeholder
  const placeholder = document.getElementById('promocao-geral-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  fetch('/api/promotion/generate-image-openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      model: 'dall-e-3'
    })
  })
  .then(response => response.json())
  .then(data => {
    const img = document.getElementById('promocao-geral-imagem-preview');
    
    if (data.success) {
      showImage(data.imageUrl);
      
      // Ajustar container
      img.onload = function() {
        const container = img.parentElement;
        const ratio = this.naturalHeight / this.naturalWidth;
        
        // Imagem vertical - mais altura
        if (ratio > 1.2) {
          container.style.maxHeight = '750px';
        } else {
          container.style.maxHeight = '650px';
        }
        
        // Garantir que imagem esteja visível
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      
      // NÃO mostrar alert! Apenas atualizar UI
      console.log('✅ Imagem gerada:', data.imageUrl);
      
    } else {
      alert('❌ Erro: ' + (data.error || 'Erro desconhecido'));
    }
  })
  .catch(error => {
    console.error('Erro:', error);
    alert('❌ Erro na conexão: ' + error.message);
  })
  .finally(() => {
    generateBtn.innerHTML = originalText;
    generateBtn.disabled = false;
  });
}

async function assistenteDePrompt() {
  const promptInput = document.querySelector('#promocao-geral-prompt');
  const promptOriginal = promptInput ? promptInput.value.trim() : '';
  
  if (!promptOriginal) {
    alert('Digite uma descrição da imagem primeiro');
    return;
  }

  const btn = document.querySelector('#btn-assistente-prompt');
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Melhorando...';
  btn.disabled = true;

  try {
    console.log('✨ Melhorando prompt:', promptOriginal);
    
    const response = await fetch('/api/promotion/improve-prompt', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        prompt: promptOriginal,
        language: 'pt-BR'
      })
    });

    // Verificar se é JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Servidor retornou HTML em vez de JSON. Status: ' + response.status);
    }

    const data = await response.json();
    
    if (data.success) {
      // Mostrar confirmação
      const confirmacao = confirm(
        `✨ Prompt Melhorado!\n\n` +
        `ORIGINAL:\n${promptOriginal}\n\n` +
        `MELHORADO:\n${data.improvedPrompt}\n\n` +
        `Deseja usar o prompt melhorado?`
      );
      
      if (confirmacao) {
        promptInput.value = data.improvedPrompt;
        console.log('✅ Prompt atualizado:', data.improvedPrompt);
      }
    } else {
      alert('❌ Erro ao melhorar prompt: ' + (data.error || 'Erro desconhecido'));
    }
    
  } catch (error) {
    console.error('Erro:', error);
    alert('❌ Erro ao melhorar prompt:\n' + error.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function generateGeneralPromoteMessage() {
    const themeInput = document.getElementById('gp-theme');
    const theme = themeInput.value.trim();

    if (!theme) {
        showToast('Informe o Tema ou Produto da Promoção para a IA.', 'error');
        themeInput.focus();
        return;
    }

    const discount = document.getElementById('gp-discount').value;
    const tone = document.getElementById('gp-tone').value;

    const genBtn = document.getElementById('gp-message-generate-btn');
    const spinner = genBtn.querySelector('.gp-message-spinner');
    
    genBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    try {
        const res = await fetch('/api/promote/generate-general-message', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                theme,
                discount,
                tone
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Erro ao gerar mensagem.');
        }

        const msgTextarea = document.getElementById('gp-message');
        if (msgTextarea) {
            msgTextarea.value = data.message;
        }
        showToast('Mensagem gerada com sucesso! Revise ou edite se necessário.');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        genBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

async function handleGeneralPromoteSubmit(e) {
    e.preventDefault();

    const phoneInput = document.getElementById('gp-phone');
    const groupLinkInput = document.getElementById('gp-group-link');
    const messageInput = document.getElementById('gp-message');
    const scheduleDateInput = document.getElementById('gp-schedule-date');
    const scheduleTimeInput = document.getElementById('gp-schedule-time');

    const phone = phoneInput.value.trim();
    const groupLink = groupLinkInput.value.trim();
    const mensagem = messageInput.value.trim();
    const scheduleDate = scheduleDateInput ? scheduleDateInput.value : '';
    const scheduleTime = scheduleTimeInput ? scheduleTimeInput.value : '';

    if (!phone && !groupLink) {
        showToast('Informe o WhatsApp do Cliente OU o Link do Grupo do WhatsApp.', 'error');
        phoneInput.focus();
        return;
    }

    if (phone && groupLink) {
        showToast('Informe apenas um canal: WhatsApp do Cliente OU Link de Grupo, não ambos.', 'error');
        return;
    }

    let cleanPhone = null;
    if (phone) {
        cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            showToast('Por favor, insira um número de WhatsApp válido com DDD.', 'error');
            phoneInput.focus();
            return;
        }
    }

    if (groupLink) {
        if (!groupLink.includes('chat.whatsapp.com/')) {
            showToast('Por favor, insira um link de convite do WhatsApp válido (chat.whatsapp.com/...).', 'error');
            groupLinkInput.focus();
            return;
        }
    }

    if ((scheduleDate && !scheduleTime) || (!scheduleDate && scheduleTime)) {
        showToast('Para agendar o envio, preencha a data E a hora.', 'error');
        if (!scheduleDate) scheduleDateInput.focus();
        else scheduleTimeInput.focus();
        return;
    }

    if (scheduleDate && scheduleTime) {
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        if (scheduledDateTime <= new Date()) {
            showToast('A data e hora do agendamento devem ser no futuro.', 'error');
            scheduleTimeInput.focus();
            return;
        }
    }

    if (!mensagem) {
        showToast('A mensagem a ser enviada é obrigatória. Digite ou use a IA para gerar.', 'error');
        messageInput.focus();
        return;
    }

    const submitBtn = document.getElementById('gp-promote-submit');
    const spinner = submitBtn.querySelector('.gp-promote-spinner');
    const textSpan = submitBtn.querySelector('span');

    const isScheduled = !!(scheduleDate && scheduleTime);
    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    textSpan.textContent = isScheduled ? 'Agendando...' : 'Enviando...';

    try {
        const res = await fetch('/api/promote/send-general', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: cleanPhone,
                groupLink: groupLink || null,
                mensagem,
                scheduleDate: scheduleDate || null,
                scheduleTime: scheduleTime || null,
                customImagePath: generalPromoteImagePath
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Erro ao enviar a promoção.');
        }

        if (data.scheduled) {
            showToast(data.message || 'Promoção agendada com sucesso!');
        } else {
            showToast('Promoção geral enviada via WhatsApp com sucesso!');
        }
        closeGeneralPromoteModal();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        textSpan.textContent = 'Enviar 🚀';
    }
}


// ── Image Upload ───────────────────────────────────────
function renderPreviews() {
    const container = document.getElementById('upload-previews');
    if (!container) return;

    container.innerHTML = pendingImages.map((url, i) => `
    <div class="preview-item" draggable="true" data-index="${i}" style="position: relative; cursor: grab;">
      <span style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; z-index: 5; pointer-events: none;">
        ${i === 0 ? '★ Capa' : '≡ ' + (i + 1)}
      </span>
      <img src="${url}" alt="Prévia ${i + 1}" />
      <button type="button" class="preview-remove" data-index="${i}" aria-label="Remover foto">✕</button>
    </div>`
    ).join('');

    container.querySelectorAll('.preview-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            pendingImages.splice(parseInt(btn.dataset.index), 1);
            renderPreviews();
        });
    });

    let photoDragSrcIndex = null;
    container.querySelectorAll('.preview-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            photoDragSrcIndex = parseInt(item.dataset.index);
            e.dataTransfer.effectAllowed = 'move';
            item.style.opacity = '0.4';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const dropIndex = parseInt(item.dataset.index);
            if (photoDragSrcIndex !== null && photoDragSrcIndex !== dropIndex) {
                const movedPhoto = pendingImages.splice(photoDragSrcIndex, 1)[0];
                pendingImages.splice(dropIndex, 0, movedPhoto);
                renderPreviews();
            }
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
        });
    });
}

async function uploadFiles(files) {
    const errorEl = document.getElementById('upload-error');
    errorEl.style.display = 'none';

    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erro no upload');
            }
            const { url } = await res.json();
            pendingImages.push(url);
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        }
    }
    renderPreviews();
}

// ── Form Submit ────────────────────────────────────────
async function handleFormSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('f-title').value.trim();
    const price = parseFloat(document.getElementById('f-price').value);

    if (!title) { showToast('O título é obrigatório.', 'error'); return; }
    if (isNaN(price) || price < 0) { showToast('Informe um preço válido.', 'error'); return; }

    const payload = {
        title,
        subtitle: document.getElementById('f-subtitle').value.trim(),
        price,
        category: document.getElementById('f-category').value || 'Outros',
        description: document.getElementById('f-description').value.trim(),
        images: pendingImages,
        featured: document.getElementById('f-featured').checked
    };

    const saveBtn = document.getElementById('modal-save');
    saveBtn.disabled = true;
    document.getElementById('save-text').textContent = 'Salvando...';

    try {
        let res, data;
        if (editingId) {
            res = await fetch(`/api/products/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');

        showToast(editingId ? 'Produto atualizado!' : 'Produto criado com sucesso!');
        closeModal();
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        document.getElementById('save-text').textContent = editingId ? 'Salvar Alterações' : 'Salvar Produto';
    }
}

// ── Delete Product ─────────────────────────────────────
async function deleteProduct(id) {
    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Erro ao excluir.');
        showToast('Produto excluído.');
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Sidebar ────────────────────────────────────────────
function initSidebar() {
    const toggle = document.getElementById('topbar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    }

    toggle.addEventListener('click', openSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Nav page links
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            navigateTo(link.dataset.page);
        });
    });
}

// ── Logout ────────────────────────────────────────────
async function logout() {
    showToast("Logout desativado no painel público.", "info");
}

// ── Google Gemini AI Helpers ───────────────────────────
function updateAiUiState() {
    // Sincronização Google desativada. Sistema 100% livre de Gemini/Nano Banana.
}

function extractProductData(prompt) {
    const text = prompt.toLowerCase();
    let title = '';
    let subtitle = 'Design de Época';
    let price = null;
    let category = 'Outros';
    
    // Try matching price
    const numbers = text.match(/\b\d+(?:[.,]\d{2})?\b/g);
    if (numbers) {
        for (const numStr of numbers) {
            const val = parseFloat(numStr.replace(',', '.'));
            // Filter out numbers that represent years (e.g. 1950, 1960, 2024, 2026)
            if (val > 10 && val !== 1929 && val !== 1930 && val !== 1940 && val !== 1950 && val !== 1960 && val !== 1970 && val !== 1980 && val !== 2024 && val !== 2026) {
                price = val;
                break;
            }
        }
    }
    
    // Try matching categories
    const catMap = {
        poltrona: 'Poltronas',
        cadeira: 'Cadeiras',
        mesa: 'Mesas',
        sofa: 'Sofás',
        armario: 'Armários',
        iluminacao: 'Iluminação',
        luminaria: 'Iluminação',
        lustre: 'Iluminação',
        decoracao: 'Decoração',
        quadro: 'Decoração',
        diversos: 'Diversos'
    };
    
    for (const keyword in catMap) {
        if (text.includes(keyword)) {
            category = catMap[keyword];
            break;
        }
    }
    
    // Extracting title
    let titleClean = prompt
        .replace(/(?:r\$\s*|reais\s*|por\s*|preço\s*|valor\s*)?\b\d+(?:[.,]\d{2})?\b/gi, '')
        .replace(/reais|preco|valor|categoria/gi, '')
        .replace(/poltronas|cadeiras|mesas|sofás|armários|iluminação|decoração|diversos/gi, '')
        .replace(/poltrona|cadeira|mesa|sofá|armário|luminária|lustre|quadro/gi, (m) => m.charAt(0).toUpperCase() + m.slice(1))
        .replace(/\s+/g, ' ')
        .trim();
    
    if (titleClean) {
        title = titleClean.charAt(0).toUpperCase() + titleClean.slice(1);
        title = title.replace(/^[,.\s]+|[,.\s]+$/g, '');
    } else {
        title = 'Peça Colecionável Vintage';
    }
    
    // Create an incredibly rich description based on the title and category!
    let description = `Apresentamos esta magnífica peça vintage de alta classe. Um exemplar raro e autêntico que reúne design atemporal, materiais nobres e estado de conservação primoroso. Perfeito para agregar exclusividade, história e sofisticação a qualquer ambiente contemporâneo. Detalhes minuciosamente preservados.`;
    
    const lowTitle = title.toLowerCase();
    if (lowTitle.includes('eames')) {
        title = 'Poltrona Eames com Puff';
        subtitle = 'Ícone do Design Modernista';
        description = 'A clássica e inigualável Poltrona Eames Lounge com puff. Revestida em couro de altíssima qualidade com base em alumínio fundido polido e conchas em compensado moldado de madeira nobre. Restauração premium fiel ao projeto original dos anos 50. Conforto extraordinário e presença marcante.';
    } else if (lowTitle.includes('barcelona')) {
        title = 'Cadeira Barcelona Premium';
        subtitle = 'Design Ludwig Mies van der Rohe';
        description = 'Exclusiva Cadeira Barcelona, desenhada em 1929 para o Pavilhão Alemão. Estrutura impecável em aço inoxidável maciço e polido, com estofamento em quadrados de couro legítimo costurados à mão. Um verdadeiro ícone do minimalismo e da sofisticação arquitetônica moderna.';
    } else if (lowTitle.includes('swan')) {
        title = 'Poltrona Swan em Veludo';
        subtitle = 'Clássico por Arne Jacobsen';
        description = 'Elegante Poltrona Swan com base giratória em alumínio polido e assento em veludo soft. Desenhada originalmente em 1958, esta peça esbanja curvas orgânicas esculpidas que trazem leveza, conforto ergonômico e um charme retrô inigualável para salas ou escritórios.';
    } else if (lowTitle.includes('art deco') || lowTitle.includes('deco')) {
        subtitle = 'Mobiliário Art Déco — Anos 1930';
        description = 'Sofisticada peça em estilo Art Déco dos anos 1930. Estrutura robusta em madeira de lei de alta densidade com ricos detalhes entalhados e ferragens originais em bronze patinado. Uma verdadeira obra de arte que expressa a elegância geométrica da Belle Époque.';
    } else if (lowTitle.includes('jacaranda')) {
        subtitle = 'Nobre Jacarandá da Bahia';
        description = 'Exclusivo móvel manufaturado em jacarandá maciço da Bahia, apresentando veios naturais deslumbrantes. Linhas minimalistas características do moderno design brasileiro de meados do século XX. Peça colecionável restaurada à mão com verniz natural de alta qualidade.';
    } else if (lowTitle.includes('mesa')) {
        subtitle = 'Peça Central de Convívio';
        description = 'Exclusiva mesa restaurada de tampo sólido e estrutura firme em madeira nobre. Apresenta pátina natural do tempo que enriquece sua história e valor estético. Ideal para reunir familiares e compor salas de jantar refinadas com um autêntico toque vintage.';
    } else if (lowTitle.includes('luminaria') || lowTitle.includes('lustre') || lowTitle.includes('lampada')) {
        subtitle = 'Iluminação de Destaque';
        description = 'Elegante luminária vintage apresentando cúpula de vidro soprado translúcido e detalhes estruturais em latão escovado. Proporciona iluminação difusa aconchegante, agregando um ponto de luz focal de alto valor decorativo e sofisticação cenográfica.';
    } else if (lowTitle.includes('sofa')) {
        subtitle = 'Conforto e Estética Singular';
        description = 'Lindo sofá vintage de 3 lugares com estrutura firme de madeira imunizada e pés palito torneados. Revestido em tecido nobre texturizado com costuras reforçadas e botões capitonê originais. Um móvel acolhedor que redefine a personalidade e elegância do seu living.';
    } else if (lowTitle.includes('cadeira')) {
        subtitle = 'Ergonomia e Estilo Clássico';
        description = 'Cadeira de design autoral com encosto anatômico e assento confortável revestido. Junções e cavilhas robustas preservadas, acabamento encerado acetinado que valoriza a textura natural da madeira. Excelente opção individual ou em conjunto.';
    }
    
    return {
        title,
        subtitle,
        price: price || 0,
        category,
        description
    };
}

// ── Init ──────────────────────────────────────────────
async function init() {
    const user = await checkAuth();
    if (!user) return;

    initSidebar();

    // ── Mobile bottom nav ──────────────────────────────
    document.querySelectorAll('.mob-nav-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            navigateTo(page);
            // Update active state
            document.querySelectorAll('.mob-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ── Mobile FAB → open add modal ────────────────────
    const mobFab = document.getElementById('mob-fab-add');
    if (mobFab) mobFab.addEventListener('click', openAddModal);

    // Add product (desktop button)
    document.getElementById('add-product-btn').addEventListener('click', openAddModal);

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('product-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Form submit
    document.getElementById('product-form').addEventListener('submit', handleFormSubmit);

    // File upload
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');

    fileInput.addEventListener('change', async (e) => {
        await uploadFiles(Array.from(e.target.files));
        fileInput.value = '';
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        await uploadFiles(files);
    });

    // Search & filter
    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('category-filter').addEventListener('change', renderTable);

    // Confirm delete
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        document.getElementById('confirm-dialog').classList.remove('open');
        deleteTargetId = null;
    });
    document.getElementById('confirm-delete').addEventListener('click', async () => {
        document.getElementById('confirm-dialog').classList.remove('open');
        if (deleteTargetId) {
            await deleteProduct(deleteTargetId);
            deleteTargetId = null;
        }
    });

    // Categories page
    document.getElementById('cat-add-btn').addEventListener('click', addCategory);
    document.getElementById('cat-name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Settings elements
    const bannerInput = document.getElementById('banner-upload-input');
    if (bannerInput) {
        bannerInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                uploadBanner(e.target.files[0]);
                e.target.value = '';
            }
        });
    }
    const bannerRemoveBtn = document.getElementById('banner-remove-btn');
    if (bannerRemoveBtn) {
        bannerRemoveBtn.addEventListener('click', removeBanner);
    }

    // Web App QR Modal
    function openWebAppModal() {
        const modal = document.getElementById('webapp-modal');
        const qrImg = document.getElementById('admin-qr-img');
        const adminUrl = encodeURIComponent(window.location.origin + '/admin');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=10&data=${adminUrl}&color=0D0D0D&bgcolor=FFFFFF&format=png&qzone=2`;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeWebAppModal() {
        document.getElementById('webapp-modal').classList.remove('open');
        document.body.style.overflow = '';
    }

    const navWebapp = document.getElementById('nav-webapp');
    if (navWebapp) {
        navWebapp.addEventListener('click', () => {
            // close sidebar on mobile first
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('visible');
            openWebAppModal();
        });
    }

    const webappClose = document.getElementById('webapp-modal-close');
    if (webappClose) webappClose.addEventListener('click', closeWebAppModal);

    document.getElementById('webapp-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeWebAppModal();
    });

    // Promote modal close listeners
    document.getElementById('promote-close')?.addEventListener('click', closePromoteModal);
    document.getElementById('promote-cancel')?.addEventListener('click', closePromoteModal);
    document.getElementById('promote-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closePromoteModal();
    });

    // Promote form submit
    document.getElementById('promote-form')?.addEventListener('submit', handlePromoteSubmit);

    // Promote AI generate button click
    document.getElementById('promote-ai-generate-btn')?.addEventListener('click', generatePromoteMessageWithAi);

    // ── General Promote Event Listeners ──
    document.getElementById('add-promotion-btn')?.addEventListener('click', openGeneralPromoteModal);
    document.getElementById('gp-promote-close')?.addEventListener('click', closeGeneralPromoteModal);
    document.getElementById('gp-promote-cancel')?.addEventListener('click', closeGeneralPromoteModal);
    document.getElementById('general-promote-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeGeneralPromoteModal();
    });
    document.getElementById('gp-image-generate-btn')?.addEventListener('click', generateGeneralPromoteImage);
    document.getElementById('gp-message-generate-btn')?.addEventListener('click', generateGeneralPromoteMessage);
    document.getElementById('gp-promote-form')?.addEventListener('submit', handleGeneralPromoteSubmit);

    // --- PRODUCT DETAIL GENERATION VIA IA ---
    const btnGenerateAiDetails = document.getElementById('btn-generate-ai-details');
    if (btnGenerateAiDetails) {
        btnGenerateAiDetails.addEventListener('click', async () => {
            const titleInput = document.getElementById('f-title');
            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) {
                showToast('Por favor, insira o título do produto primeiro.', 'error');
                return;
            }

            const spinner = btnGenerateAiDetails.querySelector('.ai-details-spinner');
            const textSpan = btnGenerateAiDetails.querySelector('span:not(.ai-details-spinner)');
            const originalText = textSpan ? textSpan.textContent : 'Gerar com IA';

            btnGenerateAiDetails.disabled = true;
            if (spinner) spinner.style.display = 'inline-block';
            if (textSpan) textSpan.textContent = 'Gerando...';

            try {
                const res = await fetch('/api/products/generate-details-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Erro na geração de IA');
                }

                const data = await res.json();
                if (data.success) {
                    const subtitleInput = document.getElementById('f-subtitle');
                    const descInput = document.getElementById('f-description');
                    if (subtitleInput) subtitleInput.value = data.subtitle;
                    if (descInput) descInput.value = data.description;
                    showToast('Detalhes do produto gerados com sucesso!');
                }
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
            } finally {
                btnGenerateAiDetails.disabled = false;
                if (spinner) spinner.style.display = 'none';
                if (textSpan) textSpan.textContent = originalText;
            }
        });
    }

    // --- GOOGLE DRIVE PHOTO IMPORT ---
    const btnOpenDrive = document.getElementById('btn-open-drive');
    const driveGalleryContainer = document.getElementById('drive-gallery-container');
    const btnRefreshDrive = document.getElementById('btn-refresh-drive');

    if (btnOpenDrive) {
        btnOpenDrive.addEventListener('click', async () => {
            if (driveGalleryContainer.style.display === 'none') {
                driveGalleryContainer.style.display = 'block';
                await loadDriveFiles();
            } else {
                driveGalleryContainer.style.display = 'none';
            }
        });
    }

    if (btnRefreshDrive) {
        btnRefreshDrive.addEventListener('click', async () => {
            await loadDriveFiles();
        });
    }

    const driveSearchInput = document.getElementById('drive-search-input');
    const driveDateInput = document.getElementById('drive-date-input');
    const driveSortSelect = document.getElementById('drive-sort-select');
    const btnClearDriveFilters = document.getElementById('btn-clear-drive-filters');

    if (driveSearchInput) driveSearchInput.addEventListener('input', renderDriveFilesList);
    if (driveDateInput) driveDateInput.addEventListener('change', renderDriveFilesList);
    if (driveSortSelect) driveSortSelect.addEventListener('change', renderDriveFilesList);
    
    if (btnClearDriveFilters) {
        btnClearDriveFilters.addEventListener('click', () => {
            if (driveSearchInput) driveSearchInput.value = '';
            if (driveDateInput) driveDateInput.value = '';
            if (driveSortSelect) driveSortSelect.value = 'newest';
            renderDriveFilesList();
        });
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeWebAppModal();
            closePromoteModal();
            closeGeneralPromoteModal();
            document.getElementById('confirm-dialog')?.classList.remove('open');
        }
    });

    // Hero Banner Manager Listeners
    document.getElementById('btn-add-hero-banner')?.addEventListener('click', addHeroBanner);
    document.getElementById('btn-save-hero-banners')?.addEventListener('click', saveHeroBanners);

    // Contact Messages Listeners
    document.getElementById('contact-search-input')?.addEventListener('input', renderContactsList);
    document.getElementById('btn-save-reply')?.addEventListener('click', saveReply);

    document.querySelectorAll('.contact-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.contact-filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            contactSubjectFilter = e.currentTarget.dataset.subject;
            renderContactsList();
        });
    });

    // Backup & Safety Listeners
    const btnExportBackup = document.getElementById('btn-export-backup');
    if (btnExportBackup) {
        btnExportBackup.addEventListener('click', () => {
            window.location.href = '/api/settings/backup/export';
            showToast('Download do backup iniciado!');
        });
    }

    const backupFileInput = document.getElementById('backup-file-input');
    if (backupFileInput) {
        backupFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm(`Deseja restaurar o backup a partir do arquivo "${file.name}"? Isso substituirá os dados atuais pelo arquivo selecionado.`)) {
                backupFileInput.value = '';
                return;
            }

            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const jsonData = JSON.parse(event.target.result);
                        const res = await fetch('/api/settings/backup/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(jsonData)
                        });

                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Erro ao importar backup.');

                        showToast(data.message || 'Banco restaurado com sucesso!');
                        await loadCategories();
                        await loadProducts();
                        await loadSettings();
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        backupFileInput.value = '';
                    }
                };
                reader.readAsText(file);
            } catch (err) {
                showToast(err.message, 'error');
                backupFileInput.value = '';
            }
        });
    }

    // Load data
    await loadCategories();
    await loadProducts();
    await loadSettings();
}

async function loadDriveFiles() {
    const status = document.getElementById('drive-files-status');
    const grid = document.getElementById('drive-files-grid');
    if (!grid || !status) return;

    grid.innerHTML = '';
    status.style.display = 'block';
    status.textContent = 'Buscando fotos na pasta do Google Drive...';
    driveFiles = []; // Reset local state

    try {
        const res = await fetch('/api/upload/google-drive/files');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Erro ao carregar arquivos');
        }

        const data = await res.json();
        if (data.success) {
            driveFiles = data.files || [];
            renderDriveFilesList();
        } else {
            status.style.display = 'block';
            status.textContent = 'Nenhuma foto encontrada na pasta do Google Drive.';
        }
    } catch (err) {
        console.error(err);
        status.style.display = 'block';
        status.textContent = `Falha ao carregar: ${err.message}`;
    }
}

function renderDriveFilesList() {
    const grid = document.getElementById('drive-files-grid');
    const status = document.getElementById('drive-files-status');
    if (!grid || !status) return;

    const searchQuery = document.getElementById('drive-search-input')?.value.toLowerCase().trim() || '';
    const selectedDate = document.getElementById('drive-date-input')?.value || '';
    const sortVal = document.getElementById('drive-sort-select')?.value || 'newest';

    // 1. Filter
    let filtered = [...driveFiles];

    if (searchQuery) {
        filtered = filtered.filter(file => file.name.toLowerCase().includes(searchQuery));
    }

    if (selectedDate) {
        filtered = filtered.filter(file => {
            if (!file.createdTime) return false;
            return file.createdTime.startsWith(selectedDate);
        });
    }

    // 2. Sort
    filtered.sort((a, b) => {
        if (sortVal === 'az') {
            return a.name.localeCompare(b.name);
        } else if (sortVal === 'za') {
            return b.name.localeCompare(a.name);
        } else if (sortVal === 'oldest') {
            const dateA = a.createdTime ? new Date(a.createdTime) : new Date(0);
            const dateB = b.createdTime ? new Date(b.createdTime) : new Date(0);
            return dateA - dateB;
        } else { // 'newest'
            const dateA = a.createdTime ? new Date(a.createdTime) : new Date(0);
            const dateB = b.createdTime ? new Date(b.createdTime) : new Date(0);
            return dateB - dateA;
        }
    });

    // 3. Render
    grid.innerHTML = '';

    if (filtered.length > 0) {
        status.style.display = 'none';
        grid.innerHTML = filtered.map(file => {
            const thumbUrl = `https://drive.google.com/thumbnail?id=${file.id}&w=150&h=150`;
            const dateFormatted = file.createdTime ? new Date(file.createdTime).toLocaleDateString('pt-BR') : '';
            return `
            <div class="drive-item" style="border: 1px solid var(--dark-4); border-radius: 6px; padding: 6px; text-align: center; background: var(--dark-2); display: flex; flex-direction: column; justify-content: space-between; gap: 4px;">
                <img src="${thumbUrl}" alt="${file.name}" style="width: 100%; height: 70px; object-fit: cover; border-radius: 4px; background: #000;" />
                <span style="font-size: 0.65rem; color: var(--gray-300); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.name}">
                    ${file.name}
                </span>
                ${dateFormatted ? `<span style="font-size: 0.55rem; color: var(--gray-500); display: block; margin-top: -2px;">${dateFormatted}</span>` : ''}
                <button type="button" class="btn btn-primary btn-import-drive" data-id="${file.id}" style="padding: 0.2rem 0.4rem; font-size: 0.65rem; width: 100%; border-radius: 4px; margin-top: 2px;">
                    Importar
                </button>
            </div>`;
        }).join('');

        grid.querySelectorAll('.btn-import-drive').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fileId = btn.dataset.id;
                await importDriveFile(fileId, btn);
            });
        });
    } else {
        status.style.display = 'block';
        status.textContent = driveFiles.length === 0 ? 'Nenhuma foto encontrada na pasta do Google Drive.' : 'Nenhuma foto corresponde aos filtros aplicados.';
    }
}

async function importDriveFile(fileId, buttonEl) {
    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = '⏳...';

    try {
        const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const res = await fetch('/api/upload/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: driveDownloadUrl })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Erro no download');
        }

        const data = await res.json();
        pendingImages.push(data.url);
        renderPreviews();
        showToast('Foto importada com sucesso!');
    } catch (err) {
        console.error(err);
        showToast(`Falha ao importar: ${err.message}`, 'error');
    } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = originalText;
    }
}

document.addEventListener('DOMContentLoaded', init);


// --- LOCAL FILE UPLOAD & DELETE HANDLERS ---
function handleFileUpload(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      showImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }
}

function showImage(src) {
  const container = document.querySelector('.image-preview-box');
  const img = document.getElementById('promocao-geral-imagem-preview');
  const placeholder = document.getElementById('promocao-geral-placeholder');
  
  // Configura a imagem e a variavel de caminho para envio
  img.src = src;
  img.style.display = 'block';
  placeholder.style.display = 'none';
  generalPromoteImagePath = src;
  
  // Adiciona botao de deletar se nao existir
  let deleteBtn = document.getElementById('btn-delete-image');
  if (!deleteBtn) {
    deleteBtn = document.createElement('button');
    deleteBtn.id = 'btn-delete-image';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.style.cssText = `
      position: absolute; top: 15px; right: 15px;
      background: rgba(0,0,0,0.7); color: white;
      border: none; border-radius: 50%; width: 32px; height: 32px;
      cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
    `;
    deleteBtn.onclick = deleteImage;
    container.appendChild(deleteBtn);
  } else {
    deleteBtn.style.display = 'flex';
  }
}

function deleteImage() {
  const img = document.getElementById('promocao-geral-imagem-preview');
  const placeholder = document.getElementById('promocao-geral-placeholder');
  const deleteBtn = document.getElementById('btn-delete-image');
  const fileInput = document.getElementById('file-upload');
  
  img.src = '';
  img.style.display = 'none';
  placeholder.style.display = 'block';
  generalPromoteImagePath = null;
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (fileInput) fileInput.value = ''; // Limpa o input
}
