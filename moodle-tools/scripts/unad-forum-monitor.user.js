// ==UserScript==
// @name         Moodle UNAD - Monitor de réplicas por grupos
// @namespace    moodle-monitor-grupos
// @version      5.0
// @description  Detecta debates con badge azul y analiza participantes solo bajo demanda
// @match        https://campus153.unad.edu.co/ses69/mod/forum/view.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const MY_NAMES = [
    'EDISSON EDUARDO OTLORA',
    'EDISSON EDUARDO OTALORA',
    'EDISSON OTALORA',
    'EDISSON'
  ];

  const UI_ID = 'tm-monitor-foros-unad';
  const BTN_ID = 'tm-monitor-btn';
  const PANEL_ID = 'tm-monitor-panel';

  const STORAGE_KEYS = {
    reviewedItems: 'tm_forum_reviewed_items_v5',
    hiddenGroups: 'tm_forum_hidden_groups_v5'
  };

  let currentResults = [];
  const analysisCache = new Map();

  init();

  function init() {
    if (document.getElementById(UI_ID)) return;

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
      width: '560px',
      maxHeight: '78vh',
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
        const nuevos = parseInt(badge.textContent.trim(), 10) || 0;
        const totalReplicas = extractTotalReplies(row);

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
          enlace: tituloEl?.href || url.toString(),
          analysis: null,
          isAnalyzing: false
        });
      });

      await sleep(250);
    }

    return resultados;
  }

  async function handlePanelActions(event) {
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
      return;
    }

    if (action === 'analyze-discussion') {
      const itemKey = target.dataset.itemKey;
      if (!itemKey) return;

      const item = currentResults.find(x => buildItemKey(x) === itemKey);
      if (!item) return;

      await analyzeDiscussion(item);
      renderResultados(currentResults);
    }
  }

  async function analyzeDiscussion(item) {
    if (!item?.enlace) return;

    if (analysisCache.has(item.enlace)) {
      item.analysis = analysisCache.get(item.enlace);
      return;
    }

    item.isAnalyzing = true;
    renderResultados(currentResults);

    try {
      const analysis = await fetchDiscussionDetails(item.enlace);
      item.analysis = analysis;
      analysisCache.set(item.enlace, analysis);
    } catch (error) {
      console.error('Error analizando discusión:', error);
      item.analysis = {
        error: error.message || 'No se pudo analizar la discusión.'
      };
    } finally {
      item.isAnalyzing = false;
    }
  }

  async function fetchDiscussionDetails(discussUrl) {
    const res = await fetch(discussUrl, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`No se pudo abrir la discusión (${res.status})`);
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const posts = Array.from(doc.querySelectorAll('[data-region-content="forum-post-core"]'));

    const mensajes = posts.map(post => {
      const autor =
        extractText(post.querySelector('header a')) ||
        extractText(post.querySelector('.author a')) ||
        extractText(post.querySelector('.author')) ||
        'No identificado';

      const timeEl = post.querySelector('time');
      const fechaTexto =
        timeEl?.getAttribute('datetime') ||
        extractText(timeEl) ||
        extractText(post.querySelector('header .mb-3')) ||
        '';

      const fecha = parseForumDate(fechaTexto);

      const mensaje =
        extractText(post.querySelector('.text_to_html')) ||
        extractText(post.querySelector('.post-content-container')) ||
        extractText(post.querySelector('.content')) ||
        '';

      const replyLink = post.querySelector('a[href*="/mod/forum/post.php?reply="]');
      const replyUrl = replyLink?.href || '';
      const replyPostIdMatch = replyUrl.match(/[?&]reply=(\d+)/);
      const replyPostId = replyPostIdMatch ? replyPostIdMatch[1] : '';

      return {
        autor,
        fechaTexto,
        fecha,
        mensaje: truncate(mensaje, 220),
        replyUrl,
        replyPostId
      };
    });

    const mensajesDeOtros = mensajes.filter(m => !isMine(m.autor) && isValidDate(m.fecha));
    const misMensajes = mensajes.filter(m => isMine(m.autor) && isValidDate(m.fecha));

    const ultimaFechaMia = misMensajes.length
      ? new Date(Math.max(...misMensajes.map(m => m.fecha.getTime())))
      : null;

    const mensajesNuevos = mensajesDeOtros.filter(m => {
      if (!ultimaFechaMia) return true;
      return m.fecha.getTime() > ultimaFechaMia.getTime();
    });

    const grouped = new Map();

    for (const msg of mensajesNuevos) {
      const key = normalizeName(msg.autor) || 'NO_IDENTIFICADO';

      if (!grouped.has(key)) {
        grouped.set(key, {
          autor: msg.autor || 'No identificado',
          cantidad: 0,
          ultimoMensajePreview: '',
          replyUrl: '',
          replyPostId: '',
          ultimaFecha: null
        });
      }

      const item = grouped.get(key);
      item.cantidad += 1;

      if (!item.ultimaFecha || (isValidDate(msg.fecha) && msg.fecha.getTime() >= item.ultimaFecha.getTime())) {
        item.ultimaFecha = msg.fecha;
        item.ultimoMensajePreview = msg.mensaje;
        item.replyUrl = msg.replyUrl;
        item.replyPostId = msg.replyPostId;
      }
    }

    const participantesConNuevos = Array.from(grouped.values())
      .sort((a, b) => {
        const at = isValidDate(a.ultimaFecha) ? a.ultimaFecha.getTime() : 0;
        const bt = isValidDate(b.ultimaFecha) ? b.ultimaFecha.getTime() : 0;
        return bt - at;
      })
      .map(item => ({
        autor: item.autor,
        cantidad: item.cantidad,
        ultimoMensajePreview: item.ultimoMensajePreview,
        replyUrl: item.replyUrl,
        replyPostId: item.replyPostId,
        ultimaFecha: isValidDate(item.ultimaFecha) ? item.ultimaFecha.toISOString() : ''
      }));

    return {
      ultimaFechaMia: ultimaFechaMia ? ultimaFechaMia.toISOString() : '',
      mensajesNuevosCount: mensajesNuevos.length,
      participantesConNuevos
    };
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
        const analysis = item.analysis;

        const analysisHtml = item.isAnalyzing
          ? `
            <div style="padding:10px;border:1px dashed #ddd;border-radius:8px;margin-top:8px;background:#fff;">
              <div style="font-size:12px;color:#666;">Analizando discusión...</div>
            </div>
          `
          : analysis?.error
            ? `
              <div style="padding:10px;border:1px solid #f1caca;border-radius:8px;margin-top:8px;background:#fff3f3;color:#a33;">
                ${escapeHtml(analysis.error)}
              </div>
            `
            : analysis
              ? renderAnalysisBlock(analysis)
              : '';

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
              <button
                data-action="analyze-discussion"
                data-item-key="${escapeAttribute(itemKey)}"
                style="${smallActionButtonStyle('#eef5ff', '#0d6efd', '#b8d4ff')}">
                Analizar
              </button>
              <button
                data-action="mark-reviewed"
                data-item-key="${escapeAttribute(itemKey)}"
                style="${smallActionButtonStyle('#eef5ff', '#0d6efd', '#b8d4ff')}">
                Marcar revisado
              </button>
            </div>
            ${analysisHtml}
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
              <button
                data-action="hide-group"
                data-group-id="${escapeAttribute(grupoId)}"
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

  function renderAnalysisBlock(analysis) {
    const participantes = analysis.participantesConNuevos || [];

    return `
      <div style="margin-top:8px;padding:10px;border:1px solid #e8eefc;border-radius:8px;background:#f8fbff;">
        <div style="font-size:12px;color:#555;margin-bottom:6px;">
          Última fecha tuya: <strong>${analysis.ultimaFechaMia || 'No detectada'}</strong>
        </div>
        <div style="font-size:12px;color:#555;margin-bottom:8px;">
          Mensajes nuevos detectados después de tu última publicación: <strong>${analysis.mensajesNuevosCount || 0}</strong>
        </div>
        ${
          participantes.length
            ? participantes.map((p, idx) => `
              <div style="padding:10px;border:1px solid #ececec;border-radius:8px;margin-top:8px;background:#fff;">
                <div style="font-size:13px;font-weight:700;color:#222;">
                  ${idx + 1}. ${escapeHtml(p.autor)}
                </div>
                <div style="font-size:12px;color:#555;margin-top:4px;">
                  ${p.cantidad} mensaje(s) nuevo(s) después de tu última publicación
                </div>
                ${p.ultimoMensajePreview ? `
                  <div style="font-size:12px;color:#666;margin-top:6px;line-height:1.4;">
                    ${escapeHtml(p.ultimoMensajePreview)}
                  </div>
                ` : ''}
                <div style="margin-top:8px;">
                  ${
                    p.replyUrl
                      ? `<a href="${escapeAttribute(p.replyUrl)}" target="_blank" rel="noopener noreferrer" style="${inlineLinkStyle()}">Abrir respuesta avanzada</a>`
                      : `<span style="font-size:12px;color:#999;">Sin URL de respuesta</span>`
                  }
                </div>
              </div>
            `).join('')
            : `
              <div style="padding:10px;border:1px dashed #ddd;border-radius:8px;background:#fff;">
                <div style="font-size:12px;color:#666;">
                  No se encontraron mensajes nuevos de otros participantes después de tu última publicación.
                </div>
              </div>
            `
        }
      </div>
    `;
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

  function extractTotalReplies(row) {
    const repliesCell = row.querySelector('td.replies');
    if (!repliesCell) return 0;

    const badgeText = row.querySelector('td.replies a.badge')?.textContent?.trim() || '';
    const allNumbers = (repliesCell.textContent || '').match(/\d+/g) || [];

    if (!allNumbers.length) return 0;
    if (allNumbers.length === 1) return parseInt(allNumbers[0], 10) || 0;

    const badgeNumber = parseInt(badgeText, 10);
    const candidates = allNumbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n));

    if (!isNaN(badgeNumber)) {
      const nonBadge = candidates.filter(n => n !== badgeNumber);
      if (nonBadge.length) return nonBadge[0];
    }

    return candidates[0] || 0;
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

  function isMine(name) {
    const normalized = normalizeName(name);
    return MY_NAMES.some(myName => normalized.includes(normalizeName(myName)));
  }

  function normalizeName(name) {
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function isValidDate(value) {
    return value instanceof Date && !isNaN(value.getTime());
  }

  function parseForumDate(text) {
    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      const isoDate = new Date(text);
      return isValidDate(isoDate) ? isoDate : null;
    }

    return null;
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

  function extractText(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
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