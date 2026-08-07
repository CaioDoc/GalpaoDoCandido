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

    // Toggle active nav links
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Update topbar title
    const titles = { products: 'Produtos', categories: 'Categorias', settings: 'Configurações' };
    document.getElementById('topbar-title').textContent = titles[page] || '';

    // Render the right page
    if (page === 'categories') renderCategoriesPage();
    if (page === 'settings') loadSettings();
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

function renderTable() {
    const tbody = document.getElementById('products-tbody');
    const filtered = getFilteredProducts();

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">
      ${products.length === 0 ? 'Nenhum produto cadastrado ainda. Adicione o primeiro!' : 'Nenhum produto encontrado com esses filtros.'}
    </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const validImages = (p.images || []).filter(i => i && !i.includes('demo-'));
        const firstImg = validImages[0];
        const imgHtml = firstImg
            ? `<img class="table-img" src="${firstImg}" alt="${p.title}" loading="lazy">`
            : `<div class="table-img-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>`;

        return `
      <tr data-id="${p.id}">
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

    // Promote buttons
    tbody.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', () => openPromoteModal(btn.dataset.id));
    });

    // Edit buttons
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    // Delete buttons
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteTargetId = btn.dataset.id;
            document.getElementById('confirm-msg').textContent = `"${btn.dataset.title}" será removido permanentemente.`;
            document.getElementById('confirm-dialog').classList.add('open');
        });
    });
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

// ── Settings (Banner) ──────────────────────────────────
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        const bannerUrl = settings.banner_url || '';

        const previewImg = document.getElementById('banner-preview-img');
        const emptyText = document.getElementById('banner-preview-empty');
        const removeBtn = document.getElementById('banner-remove-btn');

        if (bannerUrl) {
            previewImg.src = bannerUrl;
            previewImg.style.display = 'block';
            emptyText.style.display = 'none';
            removeBtn.style.display = 'inline-block';
        } else {
            previewImg.src = '';
            previewImg.style.display = 'none';
            emptyText.style.display = 'block';
            removeBtn.style.display = 'none';
        }
    } catch {
        showToast('Erro ao carregar configurações.', 'error');
    }
}

async function uploadBanner(file) {
    const overlay = document.getElementById('banner-upload-overlay');
    overlay.style.display = 'flex';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const resUpload = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!resUpload.ok) throw new Error('Erro ao fazer upload da imagem.');

        const { url } = await resUpload.json();

        const resSave = await fetch('/api/settings/banner', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!resSave.ok) throw new Error('Erro ao salvar configuração do banner.');

        showToast('Banner atualizado com sucesso!');
        loadSettings();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        overlay.style.display = 'none';
    }
}

async function removeBanner() {
    try {
        const res = await fetch('/api/settings/banner', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: '' })
        });
        if (!res.ok) throw new Error('Erro ao remover banner.');

        showToast('Banner removido. O sistema usará o padrão.');
        loadSettings();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

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
    container.innerHTML = pendingImages.map((url, i) => `
    <div class="preview-item" data-index="${i}">
      <img src="${url}" alt="Prévia ${i + 1}" />
      <button type="button" class="preview-remove" data-index="${i}" aria-label="Remover foto">✕</button>
    </div>`
    ).join('');

    container.querySelectorAll('.preview-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingImages.splice(parseInt(btn.dataset.index), 1);
            renderPreviews();
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

    // Load data
    await loadCategories();
    await loadProducts();
}

async function loadDriveFiles() {
    const grid = document.getElementById('drive-files-grid');
    const status = document.getElementById('drive-files-status');
    if (!grid || !status) return;

    grid.innerHTML = '';
    status.style.display = 'block';
    status.textContent = 'Buscando fotos na pasta do Google Drive...';

    try {
        const res = await fetch('/api/upload/google-drive/files');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Erro ao carregar arquivos');
        }

        const data = await res.json();
        status.style.display = 'none';

        if (data.success && data.files.length > 0) {
            grid.innerHTML = data.files.map(file => {
                const thumbUrl = `https://drive.google.com/thumbnail?id=${file.id}&w=150&h=150`;
                return `
                <div class="drive-item" style="border: 1px solid var(--dark-4); border-radius: 6px; padding: 6px; text-align: center; background: var(--dark-2); display: flex; flex-direction: column; justify-content: space-between; gap: 4px;">
                    <img src="${thumbUrl}" alt="${file.name}" style="width: 100%; height: 70px; object-fit: cover; border-radius: 4px; background: #000;" />
                    <span style="font-size: 0.65rem; color: var(--gray-300); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.name}">
                        ${file.name}
                    </span>
                    <button type="button" class="btn btn-primary btn-import-drive" data-id="${file.id}" style="padding: 0.2rem 0.4rem; font-size: 0.65rem; width: 100%; border-radius: 4px;">
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
            status.textContent = 'Nenhuma foto encontrada na pasta do Google Drive.';
        }
    } catch (err) {
        console.error(err);
        status.style.display = 'block';
        status.textContent = `Falha ao carregar: ${err.message}`;
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
