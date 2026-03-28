// ==UserScript==
// @name         Moodle UNAD - Monitor de réplicas por grupos
// @namespace    moodle-monitor-grupos
// @version      2.0
// @description  Revisa grupos separados y muestra mensajes nuevos en foros, con estado local de revisado y oculto
// @match        https://campus153.unad.edu.co/ses69/mod/forum/view.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const UI_ID = 'tm-monitor-foros-unad';
  const BTN_ID = 'tm-monitor-btn';
  const PANEL_ID = 'tm-monitor-panel';

  const STORAGE_KEYS = {
    reviewedItems: 'tm_forum_reviewed_items_v1',
    hiddenGroups: 'tm_forum_hidden_groups_v1'
  };

  let currentResults = [];

  init();

  function init() {
    if (document.getElementById(UI_ID)) return;

    console.log('Monitor de foros: iniciando');

    const container = document.createElement('div');
    container.id = UI_ID;

    const button = document.createElement('button');
    button.id = BTN_ID;
    button.textContent = 'Revisar grupos';
    Object.assign(button.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '999999',
      padding: '12px 16px',
      border: 'none',
      borderRadius: '10px',
      background: '#0d6efd',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
    });

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: 'fixed',
      right: '20px',
      bottom: '72px',
      width: '460px',
      maxHeight: '75vh',
      overflowY: 'auto',
      background: '#fff',
      color: '#222',
      border: '1px solid #d9d9d9',
      borderRadius: '12px',
      padding: '14px',
      zIndex: '999998',
      boxShadow: '0 10px 28px rgba(0,0,0,0.2)',
      display: 'none',
      fontFamily: 'Arial, sans-serif'
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <strong style="font-size:16px;">Monitor de grupos</strong>
        <button id="tm-monitor-close" style="border:none;background:transparent;font-size:18px;cursor:pointer;">×</button>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button id="tm-reset-filters" style="${smallActionButtonStyle()}">Restablecer filtros</button>
        <button id="tm-show-panel-summary" style="${smallActionButtonStyle('#f7f7f7', '#333', '#d9d9d9')}">Actualizar vista</button>
      </div>

      <div id="tm-monitor-summary" style="margin-bottom:12px;font-size:14px;color:#444;">
        Aún no se ha ejecutado la revisión.
      </div>

      <div id="tm-monitor-content"></div>
    `;

    container.appendChild(button);
    container.appendChild(panel);
    document.body.appendChild(container);

    button.addEventListener('click', handleReview);

    panel.querySelector('#tm-monitor-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    panel.querySelector('#tm-reset-filters').addEventListener('click', () => {
      if (!confirm('¿Deseas restablecer los debates revisados y los grupos ocultos?')) return;
      clearReviewedItems();
      clearHiddenGroups();
      renderResultados(currentResults);
    });

    panel.querySelector('#tm-show-panel-summary').addEventListener('click', () => {
      renderResultados(currentResults);
    });

    panel.addEventListener('click', handlePanelActions);

    console.log('Monitor de foros: interfaz creada');
  }

  async function handleReview() {
    const button = document.getElementById(BTN_ID);
    const panel = document.getElementById(PANEL_ID);
    const summary = document.getElementById('tm-monitor-summary');
    const content = document.getElementById('tm-monitor-content');

    panel.style.display = 'block';
    button.disabled = true;
    button.textContent = 'Revisando...';
    summary.textContent = 'Consultando grupos, por favor espera...';
    content.innerHTML = '<div style="font-size:13px;color:#666;">Procesando información...</div>';

    try {
      const resultados = await revisarGrupos();
      currentResults = resultados;
      renderResultados(currentResults);
    } catch (error) {
      console.error(error);
      summary.textContent = 'Ocurrió un error al revisar los grupos.';
      content.innerHTML = `
        <div style="padding:10px;border-radius:8px;background:#fff3f3;border:1px solid #f1caca;color:#a33;">
          ${escapeHtml(error.message || 'Error desconocido')}
        </div>
      `;
    } finally {
      button.disabled = false;
      updateButtonText(currentResults);
    }
  }

  async function revisarGrupos() {
    const select = document.querySelector('select[name="group"]');
    if (!select) {
      throw new Error('No se encontró el selector de grupos en esta página.');
    }

    const grupos = Array.from(select.options)
      .map(opt => ({
        id: opt.value,
        nombre: opt.textContent.trim()
      }))
      .filter(g => g.id && g.id !== '0');

    const baseUrl = new URL(window.location.href);
    const resultados = [];

    for (const grupo of grupos) {
      const url = new URL(baseUrl);
      url.searchParams.set('group', grupo.id);

      const res = await fetch(url.toString(), {
        credentials: 'include'
      });

      if (!res.ok) {
        console.warn(`No se pudo consultar el grupo ${grupo.nombre}: ${res.status}`);
        continue;
      }

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rows = doc.querySelectorAll('tr.discussion');

      rows.forEach(row => {
        const badge = row.querySelector('a.badge.bg-primary');
        if (!badge) return;

        const tituloEl = row.querySelector('th.topic a');
        const totalReplicasEl = row.querySelector('td.replies span');
        const nuevos = parseInt(badge.textContent.trim(), 10) || 0;
        const totalReplicas = parseInt(totalReplicasEl?.textContent?.trim() || '0', 10);

        let discussionId = row.getAttribute('data-discussionid') || '';
        if (!discussionId && tituloEl?.href) {
          const match = tituloEl.href.match(/[?&]d=(\d+)/);
          discussionId = match ? match[1] : '';
        }

        resultados.push({
          discussionId,
          grupoId: String(grupo.id),
          grupo: grupo.nombre,
          titulo: tituloEl?.textContent?.trim() || 'Sin título',
          nuevos,
          totalReplicas,
          enlace: tituloEl?.href || url.toString()
        });
      });

      await sleep(250);
    }

    return resultados;
  }

  function renderResultados(resultados) {
    const panel = document.getElementById(PANEL_ID);
    const summary = panel.querySelector('#tm-monitor-summary');
    const content = panel.querySelector('#tm-monitor-content');

    const visibles = filterVisibleResults(resultados);

    updateButtonText(resultados, visibles);

    if (resultados.length === 0) {
      summary.textContent = 'Aún no hay resultados de revisión.';
      content.innerHTML = `
        <div style="padding:12px;border:1px solid #ddd;background:#fafafa;border-radius:8px;color:#444;">
          Presiona Revisar grupos para consultar novedades.
        </div>
      `;
      return;
    }

    if (visibles.length === 0) {
      const totalOriginalMensajes = resultados.reduce((acc, item) => acc + item.nuevos, 0);
      const totalOriginalGrupos = new Set(resultados.map(item => item.grupoId)).size;

      summary.textContent = `Encontré ${totalOriginalMensajes} mensajes nuevos en ${totalOriginalGrupos} grupos, pero todos están filtrados como revisados u ocultos.`;

      content.innerHTML = `
        <div style="padding:12px;border:1px solid #d9ead7;background:#f6fff5;border-radius:8px;color:#2f6b2f;">
          No hay elementos visibles en el panel.
        </div>
      `;
      return;
    }

    const totalMensajes = visibles.reduce((acc, item) => acc + item.nuevos, 0);
    const totalGruposConNovedad = new Set(visibles.map(item => item.grupoId)).size;

    summary.textContent = `Tienes ${totalMensajes} mensajes nuevos visibles en ${totalGruposConNovedad} grupos.`;

    const agrupados = groupBy(visibles, 'grupo');

    const bloques = Object.entries(agrupados).map(([grupo, items]) => {
      const subtotal = items.reduce((acc, item) => acc + item.nuevos, 0);
      const grupoId = items[0]?.grupoId || '';

      const debates = items.map(item => {
        const itemKey = buildItemKey(item);

        return `
          <div style="padding:10px;border:1px solid #ececec;border-radius:8px;margin-bottom:8px;background:#fff;">
            <div style="font-weight:600;font-size:14px;line-height:1.35;margin-bottom:6px;">
              ${escapeHtml(item.titulo)}
            </div>
            <div style="font-size:12px;color:#555;margin-bottom:8px;">
              Nuevos: <strong>${item.nuevos}</strong> · Réplicas totales: <strong>${item.totalReplicas}</strong>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="${escapeAttribute(item.enlace)}" target="_blank" rel="noopener noreferrer"
                 style="${inlineLinkStyle()}">
                Abrir debate
              </a>
              <button data-action="mark-reviewed" data-item-key="${escapeAttribute(itemKey)}"
                      style="${smallActionButtonStyle('#eef5ff', '#0d6efd', '#b8d4ff')}">
                Marcar revisado
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom:14px;padding:12px;border:1px solid #ddd;border-radius:10px;background:#fafafa;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;">
            <div>
              <div style="font-size:14px;font-weight:700;">${escapeHtml(grupo)}</div>
              <div style="font-size:12px;color:#666;margin-top:4px;">${items.length} debate(s) con novedades</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
              <div style="font-size:12px;background:#0d6efd;color:#fff;padding:4px 8px;border-radius:999px;">
                ${subtotal} nuevos
              </div>
              <button data-action="hide-group" data-group-id="${escapeAttribute(grupoId)}"
                      style="${smallActionButtonStyle('#fff3f3', '#b42318', '#f1caca')}">
                Ocultar grupo
              </button>
            </div>
          </div>
          ${debates}
        </div>
      `;
    });

    content.innerHTML = bloques.join('');
  }

  function handlePanelActions(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    if (!action) return;

    if (action === 'mark-reviewed') {
      const itemKey = target.dataset.itemKey;
      if (!itemKey) return;

      markItemReviewed(itemKey);
      renderResultados(currentResults);
      return;
    }

    if (action === 'hide-group') {
      const groupId = target.dataset.groupId;
      if (!groupId) return;

      hideGroup(groupId);
      renderResultados(currentResults);
    }
  }

  function filterVisibleResults(resultados) {
    const reviewedItems = getReviewedItems();
    const hiddenGroups = getHiddenGroups();

    return resultados.filter(item => {
      const itemKey = buildItemKey(item);
      const isReviewed = reviewedItems.includes(itemKey);
      const isHiddenGroup = hiddenGroups.includes(String(item.grupoId));
      return !isReviewed && !isHiddenGroup;
    });
  }

  function updateButtonText(resultados, visibles) {
    const button = document.getElementById(BTN_ID);
    if (!button) return;

    const source = Array.isArray(visibles) ? visibles : filterVisibleResults(resultados || []);
    const totalMensajes = source.reduce((acc, item) => acc + item.nuevos, 0);
    const totalGrupos = new Set(source.map(item => item.grupoId)).size;

    if (!resultados || resultados.length === 0) {
      button.textContent = 'Revisar grupos';
      return;
    }

    button.textContent = totalMensajes > 0
      ? `${totalMensajes} nuevos / ${totalGrupos} grupos`
      : 'Sin pendientes';
  }

  function buildItemKey(item) {
    if (item.discussionId) {
      return `discussion:${item.discussionId}`;
    }
    return `group:${item.grupoId}|link:${item.enlace}`;
  }

  function getReviewedItems() {
    return readJsonArray(STORAGE_KEYS.reviewedItems);
  }

  function saveReviewedItems(items) {
    localStorage.setItem(STORAGE_KEYS.reviewedItems, JSON.stringify(unique(items)));
  }

  function markItemReviewed(key) {
    const items = getReviewedItems();
    if (!items.includes(key)) {
      items.push(key);
      saveReviewedItems(items);
    }
  }

  function clearReviewedItems() {
    localStorage.removeItem(STORAGE_KEYS.reviewedItems);
  }

  function getHiddenGroups() {
    return readJsonArray(STORAGE_KEYS.hiddenGroups);
  }

  function saveHiddenGroups(groups) {
    localStorage.setItem(STORAGE_KEYS.hiddenGroups, JSON.stringify(unique(groups.map(String))));
  }

  function hideGroup(groupId) {
    const groups = getHiddenGroups();
    if (!groups.includes(String(groupId))) {
      groups.push(String(groupId));
      saveHiddenGroups(groups);
    }
  }

  function clearHiddenGroups() {
    localStorage.removeItem(STORAGE_KEYS.hiddenGroups);
  }

  function readJsonArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`No se pudo leer ${key} desde localStorage`, error);
      return [];
    }
  }

  function unique(arr) {
    return [...new Set(arr)];
  }

  function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const value = item[key];
      if (!acc[value]) acc[value] = [];
      acc[value].push(item);
      return acc;
    }, {});
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function inlineLinkStyle() {
    return [
      'font-size:12px',
      'color:#0d6efd',
      'text-decoration:none',
      'padding:6px 10px',
      'border:1px solid #b8d4ff',
      'border-radius:8px',
      'background:#eef5ff',
      'display:inline-block'
    ].join(';');
  }

  function smallActionButtonStyle(bg = '#f7f7f7', color = '#333', border = '#d9d9d9') {
    return [
      `background:${bg}`,
      `color:${color}`,
      `border:1px solid ${border}`,
      'border-radius:8px',
      'padding:6px 10px',
      'font-size:12px',
      'cursor:pointer'
    ].join(';');
  }

})();