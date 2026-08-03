const STORAGE_KEY = 'basefill-workspace-v1';

let state = null;
let entityMode = 'base';
let editingRecordId = null;
let selectedRecordIds = new Set();

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

async function init() {
    state = readWorkspace();
    bindEvents();
    try {
        const remoteWorkspace = await window.BasefillAPI?.loadWorkspace();
        if (remoteWorkspace) state = normaliseWorkspace(remoteWorkspace);
    } catch (error) {
        console.warn('Workspace adapter unavailable; using local data:', error);
    }
    render();
    updateApiStatus();
}

function bindEvents() {
    $('newBaseBtn').addEventListener('click', () => openEntityModal('base'));
    $('quickNewBaseBtn').addEventListener('click', () => openEntityModal('base'));
    $('newCollectionBtn').addEventListener('click', () => openEntityModal('collection'));
    $('addRecordBtn').addEventListener('click', () => openRecordModal());
    $('emptyAddRecordBtn').addEventListener('click', () => openRecordModal());
    $('addFieldBtn').addEventListener('click', openFieldModal);
    $('deleteBaseBtn').addEventListener('click', deleteActiveBase);
    $('deleteCollectionBtn').addEventListener('click', deleteActiveCollection);
    $('recordSearch').addEventListener('input', renderRecords);
    $('deleteSelectedBtn').addEventListener('click', deleteSelectedRecords);
    $('clearSelectionBtn').addEventListener('click', clearSelection);
    $('copyJsonBtn').addEventListener('click', copyCollectionJson);
    $('exportBtn').addEventListener('click', exportCollection);
    $('apiSettingsBtn').addEventListener('click', openIntegrationModal);
    $('copyIntegrationBtn').addEventListener('click', copyIntegrationHook);
    $('importBtn').addEventListener('click', openImportModal);
    $('emptyImportBtn').addEventListener('click', openImportModal);
    $('confirmImportBtn').addEventListener('click', importRecords);
    $('importFile').addEventListener('change', handleImportFile);
    $('entityForm').addEventListener('submit', handleEntitySubmit);
    $('fieldForm').addEventListener('submit', handleFieldSubmit);
    $('recordForm').addEventListener('submit', handleRecordSubmit);
    $('tableWrap').addEventListener('click', handleTableClick);
    $('tableWrap').addEventListener('change', handleTableChange);

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.closeModal));
    });

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener('keydown', (event) => {
        const targetTag = event.target.tagName.toLowerCase();
        if (event.key === '/' && targetTag !== 'input' && targetTag !== 'textarea') {
            event.preventDefault();
            $('recordSearch').focus();
        }
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal:not([hidden])').forEach((modal) => closeModal(modal.id));
        }
    });
}

function createId(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function createField(key, label, type = 'text', required = false) {
    return { key, label, type, required };
}

function createCollection(name, description = '') {
    return {
        id: createId('col'),
        name,
        description: description || 'A collection ready for seed data.',
        fields: [
            createField('id', 'ID', 'text', true),
            createField('name', 'Name', 'text', true),
            createField('status', 'Status', 'status'),
            createField('created_at', 'Created at', 'date')
        ],
        records: []
    };
}

function getDefaultWorkspace() {
    const users = {
        id: 'collection_users',
        name: 'Users',
        description: 'People and service accounts used across the product.',
        fields: [
            createField('id', 'ID', 'text', true),
            createField('name', 'Name', 'text', true),
            createField('email', 'Email', 'text'),
            createField('role', 'Role', 'text'),
            createField('status', 'Status', 'status'),
            createField('created_at', 'Created at', 'date')
        ],
        records: [
            {
                id: 'usr_001',
                name: 'Maya Chen',
                email: 'maya@example.dev',
                role: 'Admin',
                status: 'active',
                created_at: '2026-07-18'
            },
            {
                id: 'usr_002',
                name: 'Noah Williams',
                email: 'noah@example.dev',
                role: 'Editor',
                status: 'active',
                created_at: '2026-07-22'
            },
            {
                id: 'usr_003',
                name: 'Priya Shah',
                email: 'priya@example.dev',
                role: 'Viewer',
                status: 'draft',
                created_at: '2026-07-29'
            }
        ]
    };

    const projects = {
        id: 'collection_projects',
        name: 'Projects',
        description: 'Projects to use in local development and previews.',
        fields: [
            createField('id', 'ID', 'text', true),
            createField('name', 'Name', 'text', true),
            createField('owner', 'Owner', 'text'),
            createField('status', 'Status', 'status'),
            createField('created_at', 'Created at', 'date')
        ],
        records: [
            { id: 'prj_001', name: 'Atlas', owner: 'Maya Chen', status: 'active', created_at: '2026-07-15' },
            { id: 'prj_002', name: 'Orbit', owner: 'Noah Williams', status: 'draft', created_at: '2026-07-25' }
        ]
    };

    const flags = {
        id: 'collection_flags',
        name: 'Feature flags',
        description: 'Toggleable values for testing new product behavior.',
        fields: [
            createField('id', 'ID', 'text', true),
            createField('name', 'Name', 'text', true),
            createField('enabled', 'Enabled', 'boolean'),
            createField('description', 'Description', 'text')
        ],
        records: [
            { id: 'flag_001', name: 'new_dashboard', enabled: true, description: 'Use the new developer dashboard.' },
            { id: 'flag_002', name: 'audit_log', enabled: false, description: 'Record audit events in preview builds.' }
        ]
    };

    return {
        version: 1,
        activeBaseId: 'base_product',
        activeCollectionId: users.id,
        bases: [
            {
                id: 'base_product',
                name: 'Product API',
                description: 'A compact seed workspace for your product data.',
                collections: [users, projects, flags]
            },
            {
                id: 'base_staging',
                name: 'Staging sandbox',
                description: 'Scratch data for local integration tests.',
                collections: [createCollection('Records', 'A blank collection for your next seed.')]
            }
        ]
    };
}

function readWorkspace() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return normaliseWorkspace(JSON.parse(saved));
    } catch (error) {
        console.warn('Could not read workspace:', error);
    }
    return getDefaultWorkspace();
}

function normaliseWorkspace(workspace) {
    if (!workspace || !Array.isArray(workspace.bases) || workspace.bases.length === 0) {
        return getDefaultWorkspace();
    }

    workspace.bases = workspace.bases.map((base) => ({
        id: base.id || createId('base'),
        name: base.name || 'Untitled base',
        description: base.description || 'A workspace for seed data.',
        collections: Array.isArray(base.collections) && base.collections.length > 0
            ? base.collections.map(normaliseCollection)
            : [createCollection('Records')]
    }));
    workspace.version = 1;
    ensureActiveSelection(workspace);
    return workspace;
}

function normaliseCollection(collection) {
    const fields = Array.isArray(collection.fields) && collection.fields.length > 0
        ? collection.fields.map((field) => ({
            key: field.key || fieldKey(field.label || 'field'),
            label: field.label || labelFromKey(field.key || 'field'),
            type: ['text', 'number', 'date', 'boolean', 'url', 'status'].includes(field.type) ? field.type : 'text',
            required: Boolean(field.required)
        }))
        : createCollection(collection.name || 'Records').fields;

    if (!fields.some((field) => field.key === 'id')) fields.unshift(createField('id', 'ID', 'text', true));

    return {
        id: collection.id || createId('col'),
        name: collection.name || 'Untitled collection',
        description: collection.description || 'A collection ready for seed data.',
        fields,
        records: Array.isArray(collection.records) ? collection.records : []
    };
}

function ensureActiveSelection(workspace = state) {
    const base = workspace.bases.find((item) => item.id === workspace.activeBaseId) || workspace.bases[0];
    workspace.activeBaseId = base.id;
    if (!Array.isArray(base.collections) || base.collections.length === 0) base.collections = [createCollection('Records')];
    const collection = base.collections.find((item) => item.id === workspace.activeCollectionId) || base.collections[0];
    workspace.activeCollectionId = collection.id;
}

function getActiveBase() {
    ensureActiveSelection();
    return state.bases.find((base) => base.id === state.activeBaseId);
}

function getActiveCollection() {
    const base = getActiveBase();
    return base.collections.find((collection) => collection.id === state.activeCollectionId) || base.collections[0];
}

function saveWorkspace() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        $('storageStatus').textContent = 'Saved locally';
    } catch (error) {
        console.warn('Could not save workspace:', error);
        $('storageStatus').textContent = 'Save unavailable';
        showToast('Could not save this change locally.', 'error');
    }

    const remoteSave = window.BasefillAPI?.saveWorkspace(state);
    if (remoteSave && typeof remoteSave.catch === 'function') {
        remoteSave.catch((error) => console.warn('Workspace adapter save failed:', error));
    }
}

function updateApiStatus() {
    const connected = Boolean(window.BasefillAPI?.isConfigured);
    const badge = $('apiStatusBadge');
    const title = $('integrationStatusTitle');
    const copy = $('integrationStatusCopy');
    if (connected) {
        badge.innerHTML = '<span class="workspace-dot" aria-hidden="true"></span>API connected';
        title.textContent = 'Your adapter is connected';
        copy.textContent = 'This workspace can now hydrate and persist through your configured integration hooks.';
    } else {
        badge.innerHTML = '<span class="workspace-dot" aria-hidden="true"></span>Demo mode';
        title.textContent = 'Running in demo mode';
        copy.textContent = 'Records are saved in this browser until your adapter is connected.';
    }
}

function openIntegrationModal() {
    updateApiStatus();
    openModal('integrationModal');
}

function copyIntegrationHook() {
    const snippet = `window.BasefillAPI.hooks.loadWorkspace = async () => {
  return fetch('/api/workspace').then(response => response.json());
};`;
    copyText(snippet).then(() => showToast('Starter hook copied to clipboard.')).catch(() => showToast('Could not copy the starter hook.', 'error'));
}

function emitIntegrationHook(hookName, payload) {
    const result = window.BasefillAPI?.emit(hookName, payload);
    if (result && typeof result.catch === 'function') {
        result.catch((error) => console.warn(`${hookName} hook failed:`, error));
    }
}

function render() {
    ensureActiveSelection();
    renderBases();
    renderBaseSummary();
    renderCollections();
    renderCollectionHeader();
    renderRecords();
    renderFields();
    saveWorkspace();
}

function renderBases() {
    const list = $('basesList');
    list.innerHTML = state.bases.map((base) => {
        const collectionCount = base.collections.length;
        return `
            <button class="base-item ${base.id === state.activeBaseId ? 'active' : ''}" type="button" data-base-id="${escapeAttribute(base.id)}">
                <span class="base-item-mark" aria-hidden="true">${escapeHtml(base.name.slice(0, 1).toUpperCase())}</span>
                <span class="base-item-copy">
                    <strong>${escapeHtml(base.name)}</strong>
                    <small>${collectionCount} collection${collectionCount === 1 ? '' : 's'}</small>
                </span>
                <span class="base-item-arrow" aria-hidden="true">›</span>
            </button>
        `;
    }).join('');

    list.querySelectorAll('[data-base-id]').forEach((button) => {
        button.addEventListener('click', () => {
            state.activeBaseId = button.dataset.baseId;
            ensureActiveSelection();
            selectedRecordIds.clear();
            $('recordSearch').value = '';
            render();
        });
    });
}

function renderBaseSummary() {
    const base = getActiveBase();
    $('activeBaseName').textContent = base.name;
    $('baseTitle').textContent = base.name;
    $('baseDescription').textContent = base.description;
}

function renderCollections() {
    const base = getActiveBase();
    const list = $('collectionsList');
    list.innerHTML = base.collections.map((collection) => `
        <button class="collection-item ${collection.id === state.activeCollectionId ? 'active' : ''}" type="button" data-collection-id="${escapeAttribute(collection.id)}">
            <span class="collection-icon" aria-hidden="true">${escapeHtml(collection.name.slice(0, 1).toUpperCase())}</span>
            <span class="collection-item-copy">
                <strong>${escapeHtml(collection.name)}</strong>
                <small>${collection.records.length} record${collection.records.length === 1 ? '' : 's'}</small>
            </span>
        </button>
    `).join('');

    list.querySelectorAll('[data-collection-id]').forEach((button) => {
        button.addEventListener('click', () => {
            state.activeCollectionId = button.dataset.collectionId;
            selectedRecordIds.clear();
            $('recordSearch').value = '';
            render();
        });
    });
}

function renderCollectionHeader() {
    const collection = getActiveCollection();
    $('activeCollectionName').textContent = collection.name;
    $('collectionSlug').textContent = `/${slugify(collection.name)}`;
    $('collectionTitle').textContent = collection.name;
    $('collectionDescription').textContent = collection.description;
    $('fieldCount').textContent = `${collection.fields.length} field${collection.fields.length === 1 ? '' : 's'}`;
}

function renderRecords() {
    const collection = getActiveCollection();
    const searchTerm = $('recordSearch').value.trim().toLowerCase();
    const records = collection.records || [];
    const visibleRecords = records.filter((record) => {
        if (!searchTerm) return true;
        return collection.fields.some((field) => String(record[field.key] ?? '').toLowerCase().includes(searchTerm));
    });

    selectedRecordIds = new Set([...selectedRecordIds].filter((id) => records.some((record) => String(record.id) === String(id))));
    $('recordCount').textContent = searchTerm
        ? `${visibleRecords.length} of ${records.length} record${records.length === 1 ? '' : 's'}`
        : `${records.length} record${records.length === 1 ? '' : 's'}`;
    updateSelectionUI();

    const empty = records.length === 0;
    $('emptyState').hidden = !empty;
    $('tableWrap').hidden = empty;
    if (empty) {
        $('tableWrap').innerHTML = '';
        return;
    }

    if (visibleRecords.length === 0) {
        $('tableWrap').hidden = false;
        $('emptyState').hidden = true;
        $('tableWrap').innerHTML = `
            <div class="no-results">
                <div class="no-results-icon" aria-hidden="true">⌕</div>
                <strong>No matching records</strong>
                <p>Try a different search term or clear the search field.</p>
                <button type="button" class="toolbar-link" data-clear-search>Clear search</button>
            </div>
        `;
        return;
    }

    const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => selectedRecordIds.has(record.id));
    $('tableWrap').innerHTML = `
        <table class="records-table">
            <thead>
                <tr>
                    <th class="select-column"><input type="checkbox" aria-label="Select all visible records" data-select-all ${allVisibleSelected ? 'checked' : ''}></th>
                    ${collection.fields.map((field) => `<th>${escapeHtml(field.label)}${field.required ? '<span class="required-mark">*</span>' : ''}</th>`).join('')}
                    <th class="row-actions-column"><span class="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody>
                ${visibleRecords.map((record) => `
                    <tr data-record-id="${escapeAttribute(String(record.id))}">
                        <td class="select-column"><input type="checkbox" aria-label="Select ${escapeAttribute(String(record.name || record.id))}" data-select-record="${escapeAttribute(String(record.id))}" ${selectedRecordIds.has(record.id) ? 'checked' : ''}></td>
                        ${collection.fields.map((field) => `<td title="${escapeAttribute(String(record[field.key] ?? ''))}">${formatCell(record[field.key], field)}</td>`).join('')}
                        <td class="row-actions-column"><button class="row-action" type="button" data-delete-record="${escapeAttribute(String(record.id))}" aria-label="Delete record">···</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="table-footer"><span>Showing ${visibleRecords.length} of ${records.length}</span><span>Click a row to edit</span></div>
    `;
}

function renderFields() {
    const collection = getActiveCollection();
    const list = $('fieldsList');
    list.innerHTML = collection.fields.map((field) => `
        <div class="field-item">
            <div class="field-type-icon type-${escapeAttribute(field.type)}" aria-hidden="true">${fieldTypeMark(field.type)}</div>
            <div class="field-copy">
                <strong>${escapeHtml(field.label)} ${field.required ? '<span class="required-pill">Required</span>' : ''}</strong>
                <code>${escapeHtml(field.key)}</code>
            </div>
            <div class="field-actions">
                <span class="field-type-label">${escapeHtml(field.type)}</span>
                ${field.key === 'id' ? '' : `<button class="field-delete" type="button" data-delete-field="${escapeAttribute(field.key)}" aria-label="Delete ${escapeAttribute(field.label)} field">×</button>`}
            </div>
        </div>
    `).join('');

    list.querySelectorAll('[data-delete-field]').forEach((button) => {
        button.addEventListener('click', () => deleteField(button.dataset.deleteField));
    });
}

function handleTableClick(event) {
    const clearSearch = event.target.closest('[data-clear-search]');
    if (clearSearch) {
        $('recordSearch').value = '';
        renderRecords();
        return;
    }

    const deleteButton = event.target.closest('[data-delete-record]');
    if (deleteButton) {
        event.stopPropagation();
        deleteRecord(deleteButton.dataset.deleteRecord);
        return;
    }

    if (event.target.closest('input')) return;
    const row = event.target.closest('tr[data-record-id]');
    if (row) openRecordModal(row.dataset.recordId);
}

function handleTableChange(event) {
    if (event.target.matches('[data-select-record]')) {
        const id = event.target.dataset.selectRecord;
        if (event.target.checked) selectedRecordIds.add(id);
        else selectedRecordIds.delete(id);
        updateSelectionUI();
        renderRecords();
        return;
    }

    if (event.target.matches('[data-select-all]')) {
        const collection = getActiveCollection();
        const searchTerm = $('recordSearch').value.trim().toLowerCase();
        const visibleRecords = collection.records.filter((record) => !searchTerm || collection.fields.some((field) => String(record[field.key] ?? '').toLowerCase().includes(searchTerm)));
        visibleRecords.forEach((record) => {
            if (event.target.checked) selectedRecordIds.add(record.id);
            else selectedRecordIds.delete(record.id);
        });
        renderRecords();
    }
}

function updateSelectionUI() {
    const count = selectedRecordIds.size;
    $('selectionSummary').hidden = count === 0;
    $('selectionSummary').textContent = count > 0 ? `${count} selected` : '';
    $('deleteSelectedBtn').hidden = count === 0;
    $('clearSelectionBtn').hidden = count === 0;
}

function clearSelection() {
    selectedRecordIds.clear();
    renderRecords();
}

function openEntityModal(mode) {
    entityMode = mode;
    const isBase = mode === 'base';
    $('entityModalEyebrow').textContent = isBase ? 'NEW BASE' : 'NEW COLLECTION';
    $('entityModalTitle').textContent = isBase ? 'Create a base' : 'Create a collection';
    $('entityModalCopy').textContent = isBase
        ? 'Keep related seed data together in one place.'
        : 'Collections turn one base into focused, reusable data sets.';
    $('entityName').placeholder = isBase ? 'e.g. Product API' : 'e.g. Orders';
    $('entityDescription').placeholder = isBase ? 'What will this base help you seed?' : 'What belongs in this collection?';
    $('entitySubmitBtn').textContent = isBase ? 'Create base' : 'Create collection';
    $('entityForm').reset();
    openModal('entityModal');
    $('entityName').focus();
}

function handleEntitySubmit(event) {
    event.preventDefault();
    const name = $('entityName').value.trim();
    const description = $('entityDescription').value.trim();
    if (!name) return;

    if (entityMode === 'base') {
        const base = {
            id: createId('base'),
            name,
            description: description || 'A workspace for seed data.',
            collections: [createCollection('Records', 'A blank collection for your next seed.')]
        };
        state.bases.push(base);
        state.activeBaseId = base.id;
        state.activeCollectionId = base.collections[0].id;
        emitIntegrationHook('onBaseCreated', base);
        showToast(`Created ${name}.`);
    } else {
        const base = getActiveBase();
        const collection = createCollection(name, description || 'A collection ready for seed data.');
        base.collections.push(collection);
        state.activeCollectionId = collection.id;
        emitIntegrationHook('onCollectionCreated', { base, collection });
        showToast(`Added ${name} collection.`);
    }

    selectedRecordIds.clear();
    closeModal('entityModal');
    render();
}

function deleteActiveBase() {
    const base = getActiveBase();
    if (state.bases.length === 1) {
        showToast('Keep at least one base in the workspace.', 'error');
        return;
    }
    if (!window.confirm(`Delete “${base.name}” and all of its records?`)) return;
    state.bases = state.bases.filter((item) => item.id !== base.id);
    state.activeBaseId = state.bases[0].id;
    ensureActiveSelection();
    selectedRecordIds.clear();
    render();
    emitIntegrationHook('onBaseDeleted', base);
    showToast(`Deleted ${base.name}.`);
}

function deleteActiveCollection() {
    const base = getActiveBase();
    const collection = getActiveCollection();
    if (base.collections.length === 1) {
        showToast('Keep at least one collection in the base.', 'error');
        return;
    }
    if (!window.confirm(`Delete “${collection.name}” and all of its records?`)) return;
    base.collections = base.collections.filter((item) => item.id !== collection.id);
    state.activeCollectionId = base.collections[0].id;
    selectedRecordIds.clear();
    render();
    emitIntegrationHook('onCollectionDeleted', { base, collection });
    showToast(`Deleted ${collection.name}.`);
}

function openFieldModal() {
    $('fieldForm').reset();
    openModal('fieldModal');
    $('fieldLabel').focus();
}

function handleFieldSubmit(event) {
    event.preventDefault();
    const collection = getActiveCollection();
    const label = $('fieldLabel').value.trim();
    const type = $('fieldType').value;
    const required = $('fieldRequired').checked;
    const key = uniqueFieldKey(fieldKey(label), collection.fields);

    if (!label) return;
    collection.fields.push(createField(key, label, type, required));
    collection.records.forEach((record) => {
        if (!(key in record)) record[key] = getDefaultValue(collection.fields[collection.fields.length - 1]);
    });
    closeModal('fieldModal');
    render();
    emitIntegrationHook('onFieldCreated', { collection, field: collection.fields[collection.fields.length - 1] });
    showToast(`Added ${label} field.`);
}

function deleteField(key) {
    const collection = getActiveCollection();
    const field = collection.fields.find((item) => item.key === key);
    if (!field || field.key === 'id') return;
    if (!window.confirm(`Delete the “${field.label}” field from this collection?`)) return;
    collection.fields = collection.fields.filter((item) => item.key !== key);
    collection.records.forEach((record) => delete record[key]);
    render();
    emitIntegrationHook('onFieldDeleted', { collection, field });
    showToast(`Deleted ${field.label} field.`);
}

function openRecordModal(recordId = null) {
    const collection = getActiveCollection();
    editingRecordId = recordId;
    const record = recordId ? collection.records.find((item) => String(item.id) === String(recordId)) : null;
    if (recordId && !record) return;

    $('recordModalEyebrow').textContent = record ? 'EDIT RECORD' : 'NEW RECORD';
    $('recordModalTitle').textContent = record ? 'Edit record' : 'Add a record';
    $('recordForm').innerHTML = `
        <div class="record-fields-grid">
            ${collection.fields.map((field) => recordFieldMarkup(field, record ? record[field.key] : getDefaultValue(field))).join('')}
        </div>
        <div class="modal-actions">
            <button class="secondary-action" type="button" data-close-modal="recordModal">Cancel</button>
            <button class="primary-action" type="submit">${record ? 'Save changes' : 'Add record'}</button>
        </div>
    `;
    $('recordForm').querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => closeModal('recordModal'));
    });
    openModal('recordModal');
    const firstInput = $('recordForm').querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
}

function recordFieldMarkup(field, value) {
    const inputName = `record_${field.key}`;
    const required = field.required ? 'required' : '';
    const label = `${escapeHtml(field.label)}${field.required ? ' <span class="required-mark">*</span>' : ''}`;
    const helper = `<span class="field-key-hint">${escapeHtml(field.key)}</span>`;
    let input;

    if (field.type === 'boolean') {
        input = `
            <label class="toggle-field" for="${escapeAttribute(inputName)}">
                <input id="${escapeAttribute(inputName)}" type="checkbox" name="${escapeAttribute(inputName)}" ${value === true || String(value).toLowerCase() === 'true' ? 'checked' : ''}>
                <span class="toggle-track" aria-hidden="true"><span></span></span>
                <span>Enabled</span>
            </label>
        `;
    } else if (field.type === 'status') {
        const options = ['active', 'draft', 'inactive', 'archived'];
        if (value && !options.includes(String(value).toLowerCase())) options.unshift(String(value).toLowerCase());
        input = `<select id="${escapeAttribute(inputName)}" name="${escapeAttribute(inputName)}" ${required}>${options.map((option) => `<option value="${escapeAttribute(option)}" ${String(value).toLowerCase() === option ? 'selected' : ''}>${escapeHtml(labelFromKey(option))}</option>`).join('')}</select>`;
    } else if (field.type === 'number') {
        input = `<input id="${escapeAttribute(inputName)}" type="number" name="${escapeAttribute(inputName)}" value="${escapeAttribute(value ?? '')}" ${required} placeholder="Enter a number">`;
    } else if (field.type === 'date') {
        input = `<input id="${escapeAttribute(inputName)}" type="date" name="${escapeAttribute(inputName)}" value="${escapeAttribute(value ?? '')}" ${required}>`;
    } else if (field.type === 'url') {
        input = `<input id="${escapeAttribute(inputName)}" type="url" name="${escapeAttribute(inputName)}" value="${escapeAttribute(value ?? '')}" ${required} placeholder="https://...">`;
    } else {
        input = `<input id="${escapeAttribute(inputName)}" type="text" name="${escapeAttribute(inputName)}" value="${escapeAttribute(value ?? '')}" ${required} placeholder="Enter a value">`;
    }

    return `<div class="form-field record-form-field"><label for="${escapeAttribute(inputName)}">${label} ${helper}</label>${input}</div>`;
}

function handleRecordSubmit(event) {
    event.preventDefault();
    const collection = getActiveCollection();
    const form = event.currentTarget;
    const record = {};

    for (const field of collection.fields) {
        const input = form.elements[`record_${field.key}`];
        let value;
        if (field.type === 'boolean') {
            value = Boolean(input && input.checked);
        } else {
            value = input ? input.value.trim() : '';
            if (field.type === 'number' && value !== '') {
                value = Number(value);
                if (!Number.isFinite(value)) {
                    showToast(`${field.label} must be a number.`, 'error');
                    input.focus();
                    return;
                }
            }
        }
        if (field.required && value === '') {
            showToast(`${field.label} is required.`, 'error');
            if (input) input.focus();
            return;
        }
        record[field.key] = value;
    }

    record.id = String(record.id || createId('rec'));
    const duplicate = collection.records.find((item) => String(item.id) === record.id && String(item.id) !== String(editingRecordId));
    if (duplicate) {
        showToast('Every record needs a unique ID.', 'error');
        const idInput = form.elements.record_id;
        if (idInput) idInput.focus();
        return;
    }

    if (editingRecordId) {
        const index = collection.records.findIndex((item) => String(item.id) === String(editingRecordId));
        if (index !== -1) collection.records[index] = record;
        emitIntegrationHook('onRecordUpdated', { collection, record });
        showToast('Record updated.');
    } else {
        collection.records.push(record);
        emitIntegrationHook('onRecordCreated', { collection, record });
        showToast('Record added.');
    }

    editingRecordId = null;
    closeModal('recordModal');
    render();
}

function deleteRecord(recordId) {
    const collection = getActiveCollection();
    const record = collection.records.find((item) => String(item.id) === String(recordId));
    if (!record) return;
    if (!window.confirm(`Delete record “${record.name || record.id}”?`)) return;
    collection.records = collection.records.filter((item) => String(item.id) !== String(recordId));
    selectedRecordIds.delete(recordId);
    render();
    emitIntegrationHook('onRecordDeleted', { collection, record });
    showToast('Record deleted.');
}

function deleteSelectedRecords() {
    const collection = getActiveCollection();
    const count = selectedRecordIds.size;
    if (!count || !window.confirm(`Delete ${count} selected record${count === 1 ? '' : 's'}?`)) return;
    const deletedRecordIds = [...selectedRecordIds];
    collection.records = collection.records.filter((record) => !selectedRecordIds.has(record.id));
    selectedRecordIds.clear();
    render();
    emitIntegrationHook('onRecordDeleted', { collection, recordIds: deletedRecordIds });
    showToast(`${count} record${count === 1 ? '' : 's'} deleted.`);
}

function openImportModal() {
    $('importInput').value = '';
    $('importFile').value = '';
    $('importFileName').textContent = 'No file selected';
    openModal('importModal');
    $('importInput').focus();
}

async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    $('importFileName').textContent = file.name;
    try {
        $('importInput').value = await file.text();
    } catch (error) {
        showToast('Could not read that file.', 'error');
    }
}

function importRecords() {
    const raw = $('importInput').value.trim();
    if (!raw) {
        showToast('Paste JSON or CSV data first.', 'error');
        return;
    }

    let incoming;
    try {
        incoming = parseImport(raw);
    } catch (error) {
        showToast(error.message, 'error');
        return;
    }
    if (!incoming.length) {
        showToast('No records were found in that data.', 'error');
        return;
    }

    const collection = getActiveCollection();
    const existingKeys = new Set(collection.fields.map((field) => field.key));
    const keyMap = new Map(collection.fields.map((field) => [field.key.toLowerCase(), field.key]));

    incoming.forEach((rawRecord) => {
        Object.keys(rawRecord).forEach((rawKey) => {
            const baseKey = fieldKey(rawKey);
            if (keyMap.has(baseKey.toLowerCase())) return;
            const key = uniqueFieldKey(baseKey, collection.fields);
            const values = incoming.map((item) => item[rawKey]);
            collection.fields.push(createField(key, labelFromKey(key), inferFieldType(key, values)));
            existingKeys.add(key);
            keyMap.set(baseKey.toLowerCase(), key);
        });
    });

    const existingIds = new Set(collection.records.map((record) => String(record.id)));
    incoming.forEach((rawRecord, index) => {
        const record = {};
        Object.entries(rawRecord).forEach(([rawKey, value]) => {
            const key = keyMap.get(fieldKey(rawKey).toLowerCase()) || fieldKey(rawKey);
            record[key] = coerceImportedValue(value, collection.fields.find((field) => field.key === key));
        });
        let id = String(record.id || createId(`rec${index + 1}`));
        while (existingIds.has(id)) id = createId(`rec${index + 1}`);
        record.id = id;
        existingIds.add(id);
        collection.records.push(record);
    });

    selectedRecordIds.clear();
    closeModal('importModal');
    render();
    emitIntegrationHook('onRecordsImported', { collection, records: incoming });
    showToast(`Imported ${incoming.length} record${incoming.length === 1 ? '' : 's'}.`);
}

function parseImport(raw) {
    const firstCharacter = raw.trim().charAt(0);
    if (firstCharacter === '[' || firstCharacter === '{') {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new Error('That JSON is not valid.');
        }
        const records = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.records) ? parsed.records : [parsed];
        if (!records.every((record) => record && typeof record === 'object' && !Array.isArray(record))) throw new Error('JSON must contain objects.');
        return records;
    }

    const rows = parseCsv(raw);
    if (rows.length < 2) throw new Error('CSV needs a header row and at least one record.');
    const headers = rows[0].map((header, index) => fieldKey(header) || `field_${index + 1}`);
    return rows.slice(1).filter((row) => row.some((value) => value.trim() !== '')).map((row) => {
        const record = {};
        headers.forEach((header, index) => { record[header] = row[index] ?? ''; });
        return record;
    });
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const next = text[index + 1];
        if (character === '"' && quoted && next === '"') {
            value += '"';
            index += 1;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (character === ',' && !quoted) {
            row.push(value.trim());
            value = '';
        } else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && next === '\n') index += 1;
            row.push(value.trim());
            rows.push(row);
            row = [];
            value = '';
        } else {
            value += character;
        }
    }
    if (value.length > 0 || row.length > 0) {
        row.push(value.trim());
        rows.push(row);
    }
    return rows;
}

function inferFieldType(key, values) {
    const meaningfulValues = values.filter((value) => value !== '' && value !== null && value !== undefined);
    if (meaningfulValues.length > 0 && meaningfulValues.every((value) => typeof value === 'boolean' || ['true', 'false'].includes(String(value).toLowerCase()))) return 'boolean';
    if (meaningfulValues.length > 0 && meaningfulValues.every((value) => /^-?\d+(\.\d+)?$/.test(String(value)))) return 'number';
    if (meaningfulValues.length > 0 && meaningfulValues.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)))) return 'date';
    if (meaningfulValues.length > 0 && meaningfulValues.every((value) => /^https?:\/\//.test(String(value)))) return 'url';
    if (key.toLowerCase().includes('status')) return 'status';
    return 'text';
}

function coerceImportedValue(value, field) {
    if (!field) return value;
    if (field.type === 'boolean') return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
    if (field.type === 'number' && value !== '') return Number(value);
    return value;
}

function copyCollectionJson() {
    const collection = getActiveCollection();
    copyText(JSON.stringify(collection.records, null, 2)).then(() => showToast('JSON copied to clipboard.')).catch(() => showToast('Could not copy JSON.', 'error'));
}

function exportCollection() {
    const collection = getActiveCollection();
    const fileName = `${slugify(getActiveBase().name)}-${slugify(collection.name)}.json`;
    const blob = new Blob([JSON.stringify(collection.records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    emitIntegrationHook('onRecordsExported', { collection, records: collection.records, fileName });
    showToast(`Exported ${fileName}.`);
}

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            resolve();
        } catch (error) {
            reject(error);
        } finally {
            textarea.remove();
        }
    });
}

function openModal(id) {
    const modal = $(id);
    modal.hidden = false;
    document.body.classList.add('modal-open');
}

function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('modal-open');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-mark" aria-hidden="true">${type === 'error' ? '!' : '✓'}</span><span>${escapeHtml(message)}</span>`;
    $('toastContainer').appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 220);
    }, 2800);
}

function formatCell(value, field) {
    if (value === null || value === undefined || value === '') return '<span class="cell-empty">—</span>';
    if (field.type === 'status') {
        const status = String(value).toLowerCase().replace(/[^a-z0-9-]/g, '-');
        return `<span class="status-pill status-${escapeAttribute(status)}"><span class="status-pill-dot"></span>${escapeHtml(labelFromKey(String(value)))}</span>`;
    }
    if (field.type === 'boolean') return `<span class="boolean-cell ${value ? 'is-true' : 'is-false'}"><span>${value ? '✓' : '–'}</span>${value ? 'True' : 'False'}</span>`;
    if (field.type === 'url') {
        const safeUrl = /^https?:\/\//i.test(String(value)) ? String(value) : '';
        return safeUrl ? `<a class="cell-link" href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(shortenUrl(safeUrl))}</a>` : escapeHtml(String(value));
    }
    return escapeHtml(String(value));
}

function fieldTypeMark(type) {
    return { text: 'T', number: '#', date: 'D', boolean: '✓', url: '↗', status: '●' }[type] || 'T';
}

function getDefaultValue(field) {
    if (field.key === 'id') return createId('rec');
    if (field.type === 'boolean') return false;
    if (field.type === 'status') return 'draft';
    if (field.type === 'date') return new Date().toISOString().slice(0, 10);
    return '';
}

function fieldKey(value) {
    return String(value || '')
        .trim()
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0,  fortyEight());
}

function fortyEight() {
    return 48;
}

function uniqueFieldKey(key, fields) {
    const cleanKey = key || 'field';
    const existing = new Set(fields.map((field) => field.key));
    if (!existing.has(cleanKey)) return cleanKey;
    let suffix = 2;
    while (existing.has(`${cleanKey}_${suffix}`)) suffix += 1;
    return `${cleanKey}_${suffix}`;
}

function labelFromKey(key) {
    return String(key || 'Field')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function slugify(value) {
    return String(value || 'workspace').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

function shortenUrl(value) {
    try {
        const url = new URL(value);
        return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 32);
    } catch (error) {
        return String(value).slice(0, 32);
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}
