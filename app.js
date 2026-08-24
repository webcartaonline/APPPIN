const GROUPS = {
    google: { label: 'Google', file: 'Data/dataGoogle.json' },
    microsoft: { label: 'Microsoft', file: 'Data/dataMicrosoft.json' },
};

const app = document.getElementById('app');
const subtitle = document.getElementById('subtitle');
const cache = {};

function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.attrs) {
        for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
    }
    children.forEach((c) => c && node.appendChild(c));
    return node;
}

function isEmptyEntry(obj) {
    return !obj || typeof obj !== 'object' || Object.keys(obj).length === 0;
}

function mask(value) {
    return '•'.repeat(Math.min(String(value).length, 24));
}

function plainRow(label, value) {
    return el('div', { class: 'row' }, [
        el('span', { class: 'row__label', text: label }),
        el('span', { class: 'row__value', text: value }),
    ]);
}

function secretRow(label, value) {
    const valEl = el('span', { class: 'row__value row__value--masked', text: mask(value) });
    const toggleBtn = el('button', { class: 'btn', text: 'Mostrar', attrs: { type: 'button' } });
    const copyBtn = el('button', { class: 'btn', text: 'Copiar', attrs: { type: 'button' } });
    let visible = false;

    toggleBtn.addEventListener('click', () => {
        visible = !visible;
        valEl.textContent = visible ? value : mask(value);
        valEl.classList.toggle('row__value--masked', !visible);
        toggleBtn.textContent = visible ? 'Ocultar' : 'Mostrar';
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(value);
            copyBtn.textContent = 'Copiado';
        } catch {
            copyBtn.textContent = 'Error';
        } finally {
            setTimeout(() => (copyBtn.textContent = 'Copiar'), 1200);
        }
    });

    const wrap = el('div', { class: 'row__value-wrap' }, [valEl, toggleBtn, copyBtn]);
    return el('div', { class: 'row row--secret' }, [
        el('span', { class: 'row__label', text: label }),
        wrap,
    ]);
}

function renderOtro(otroArr) {
    if (!Array.isArray(otroArr) || otroArr.length === 0) return null;
    const section = el('div', { class: 'section section--list' });
    section.appendChild(el('p', { class: 'section__title', text: 'Más información' }));
    otroArr.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const label = (item.nombre || 'Info').replace(/:\s*$/, '');
        const rest = Object.entries(item).find(([k]) => k !== 'nombre');
        if (!rest) return;
        const [key, value] = rest;
        if (value == null) return;
        const isSecret = /pin|codigo|contrase/i.test(key);
        section.appendChild(isSecret ? secretRow(label, value) : plainRow(label, value));
    });
    return section.childElementCount > 1 ? section : null;
}

function renderSubAccounts(cuentasArr) {
    if (!Array.isArray(cuentasArr) || cuentasArr.length === 0) return null;
    const section = el('div', { class: 'section section--list' });
    section.appendChild(el('p', { class: 'section__title', text: 'Cuentas' }));
    cuentasArr.forEach((c) => {
        if (!c || typeof c !== 'object') return;
        if (c.pin) section.appendChild(secretRow(c.usuario || 'Cuenta', c.pin));
        else if (c.usuario) section.appendChild(plainRow('Usuario', c.usuario));
    });
    return section.childElementCount > 1 ? section : null;
}

function renderFields(container, entry, titleKey) {
    if (entry.usuario) container.appendChild(plainRow('Usuario', entry.usuario));
    if (entry.correo && titleKey !== 'correo') container.appendChild(plainRow('Correo', entry.correo));
    if (entry.pin && entry.pin !== 'N/D') container.appendChild(secretRow('PIN', entry.pin));
    if (entry.contraseña) container.appendChild(secretRow('Contraseña', entry.contraseña));

    const otro = renderOtro(entry.otro);
    if (otro) container.appendChild(otro);

    const subAccounts = renderSubAccounts(entry.cuentas);
    if (subAccounts) container.appendChild(subAccounts);

    const derivados = renderDerivados(entry.derivados);
    if (derivados) container.appendChild(derivados);
}

function renderDerivados(derivadosArr) {
    if (!Array.isArray(derivadosArr)) return null;
    const valid = derivadosArr.filter((d) => !isEmptyEntry(d));
    if (valid.length === 0) return null;

    const section = el('div', { class: 'section' });
    section.appendChild(el('p', { class: 'section__title', text: 'Servicios vinculados' }));
    valid.forEach((d) => {
        const summary = el('summary', { text: d.servicio || 'Servicio' });
        const body = el('div', { class: 'card__body' });
        renderFields(body, d, 'servicio');
        section.appendChild(el('details', { class: 'card card--nested' }, [summary, body]));
    });
    return section;
}

function renderAccount(cuenta) {
    const summary = el('summary', { text: cuenta.correo || 'Cuenta' });
    const body = el('div', { class: 'card__body' });
    renderFields(body, cuenta, 'correo');
    return el('details', { class: 'card' }, [summary, body]);
}

async function loadGroup(key) {
    if (cache[key]) return cache[key];
    const res = await fetch(GROUPS[key].file);
    if (!res.ok) throw new Error('No se pudo cargar ' + GROUPS[key].file);
    const data = await res.json();
    cache[key] = data;
    return data;
}

function renderHome() {
    subtitle.textContent = 'Empieza escogiendo la cuenta';
    app.replaceChildren();

    const grid = el('div', { class: 'group-grid' });
    Object.entries(GROUPS).forEach(([key, group]) => {
        const dot = el('span', { class: `group-card__dot group-card__dot--${key}` });
        const card = el(
            'button',
            { class: 'group-card', attrs: { type: 'button' } },
            [
                dot,
                el('span', { class: 'group-card__title', text: group.label }),
                el('span', { class: 'group-card__meta', text: 'Ver contraseñas guardadas' }),
            ]
        );
        card.addEventListener('click', () => {
            window.location.hash = `#/${key}`;
        });
        grid.appendChild(card);
    });

    app.appendChild(grid);
}

async function renderGroup(key) {
    const group = GROUPS[key];
    subtitle.textContent = group.label;
    app.replaceChildren();

    const header = el('div', { class: 'view-header' });
    const backBtn = el('button', { class: 'back-btn', text: '← Volver', attrs: { type: 'button' } });
    backBtn.addEventListener('click', () => {
        window.location.hash = '#/';
    });
    header.appendChild(backBtn);
    app.appendChild(header);

    try {
        const data = await loadGroup(key);
        const cuentas = Array.isArray(data.cuentas) ? data.cuentas : [];
        if (cuentas.length === 0) {
            app.appendChild(el('div', { class: 'empty-state', text: 'No hay cuentas guardadas.' }));
            return;
        }
        const list = el('div', { class: 'account-list' });
        cuentas.forEach((c) => list.appendChild(renderAccount(c)));
        app.appendChild(list);
    } catch (err) {
        app.appendChild(el('div', { class: 'error-state', text: err.message }));
    }
}

function route() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash && GROUPS[hash]) {
        renderGroup(hash);
    } else {
        renderHome();
    }
}

window.addEventListener('hashchange', route);
route();
