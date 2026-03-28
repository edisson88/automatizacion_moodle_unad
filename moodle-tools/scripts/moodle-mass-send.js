// ==UserScript==
// @name         Moodle UNAD - Envío masivo por grupos
// @namespace    moodle-mass-reply-groups
// @version      2.0
// @description  Envía el mismo mensaje a la primera discusión visible de cada grupo, con soporte para HTML
// @match        https://campus153.unad.edu.co/ses69/mod/forum/view.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'tm-mass-send-btn';
  const MODAL_ID = 'tm-mass-send-modal';

  init();

  function init() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = 'Enviar a todos los grupos';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '70px',
      zIndex: '999999',
      padding: '12px 16px',
      border: 'none',
      borderRadius: '10px',
      background: '#198754',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
    });

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    Object.assign(modal.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: '1000000',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    });

    modal.innerHTML = `
      <div style="width:100%;max-width:820px;background:#fff;border-radius:14px;padding:18px;box-shadow:0 12px 30px rgba(0,0,0,0.3);font-family:Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:17px;">Enviar mismo mensaje a todos los grupos</strong>
          <button id="tm-mass-send-close" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
        </div>

        <div style="font-size:13px;color:#555;margin-bottom:10px;">
          Esta versión publica una réplica dentro de la primera discusión visible de cada grupo.
        </div>

        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Asunto</label>
        <input id="tm-mass-send-subject" type="text"
          style="width:100%;border:1px solid #ccc;border-radius:10px;padding:10px;font-size:14px;margin-bottom:12px;"
          placeholder="Ej. Aviso importante para el grupo">

        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Contenido</label>
        <textarea id="tm-mass-send-message"
          style="width:100%;min-height:240px;border:1px solid #ccc;border-radius:10px;padding:12px;font-size:14px;resize:vertical;"
          placeholder="Escribe aquí el mensaje o pega tu HTML..."></textarea>

        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;">
          <input type="checkbox" id="tm-mass-send-html" checked>
          Enviar como HTML
        </label>

        <label style="display:block;font-size:13px;font-weight:600;margin-top:12px;margin-bottom:6px;">Adjuntos (opcional)</label>
        <input type="file" id="tm-mass-send-file" multiple
          style="width:100%;font-size:13px;border:1px solid #ccc;border-radius:8px;padding:8px;">
        <div style="font-size:12px;color:#777;margin-top:4px;">
          Puedes seleccionar varios archivos (Ctrl+clic). Los mismos se adjuntan a cada grupo. Verifica el límite de tamaño permitido por el foro.
        </div>

        <div id="tm-mass-send-status" style="margin-top:12px;font-size:13px;color:#444;"></div>

        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px;">
          <button id="tm-mass-send-preview" style="${smallBtn('#f7f7f7','#333','#d9d9d9')}">Vista previa</button>
          <button id="tm-mass-send-cancel" style="${smallBtn('#f7f7f7','#333','#d9d9d9')}">Cancelar</button>
          <button id="tm-mass-send-run" style="${smallBtn('#198754','#fff','#198754')}">Enviar ahora</button>
        </div>

        <div id="tm-mass-send-preview-box" style="display:none;margin-top:14px;padding:12px;border:1px solid #ddd;border-radius:10px;background:#fafafa;">
          <div style="font-size:12px;color:#666;margin-bottom:8px;">Vista previa renderizada</div>
          <div id="tm-mass-send-preview-content"></div>
        </div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(modal);

    btn.addEventListener('click', () => {
      modal.style.display = 'flex';
      modal.querySelector('#tm-mass-send-status').textContent = '';
    });

    modal.querySelector('#tm-mass-send-close').addEventListener('click', closeModal);
    modal.querySelector('#tm-mass-send-cancel').addEventListener('click', closeModal);
    modal.querySelector('#tm-mass-send-preview').addEventListener('click', previewContent);
    modal.querySelector('#tm-mass-send-run').addEventListener('click', runMassSend);
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    modal.style.display = 'none';
  }

  function previewContent() {
    const modal = document.getElementById(MODAL_ID);
    const isHtml = modal.querySelector('#tm-mass-send-html').checked;
    const raw = modal.querySelector('#tm-mass-send-message').value;
    const box = modal.querySelector('#tm-mass-send-preview-box');
    const content = modal.querySelector('#tm-mass-send-preview-content');

    box.style.display = 'block';

    if (isHtml) {
      content.innerHTML = raw;
    } else {
      content.innerHTML = plainTextToHtml(raw);
    }
  }

  async function runMassSend() {
    const modal = document.getElementById(MODAL_ID);
    const subject = modal.querySelector('#tm-mass-send-subject').value.trim();
    const message = modal.querySelector('#tm-mass-send-message').value;
    const usarHTML = modal.querySelector('#tm-mass-send-html').checked;
    const adjuntos = Array.from(modal.querySelector('#tm-mass-send-file').files);
    const status = modal.querySelector('#tm-mass-send-status');
    const runBtn = modal.querySelector('#tm-mass-send-run');

    if (!message.trim()) {
      alert('Debes escribir un mensaje.');
      return;
    }

    const select = document.querySelector('select[name="group"]');
    if (!select) {
      alert('No se encontró el selector de grupos.');
      return;
    }

    const grupos = Array.from(select.options)
      .map(opt => ({
        id: opt.value,
        nombre: opt.textContent.trim()
      }))
      .filter(g => g.id && g.id !== '0');

    if (!grupos.length) {
      alert('No se encontraron grupos válidos.');
      return;
    }

    const adjuntosInfo = adjuntos.length
      ? `\nArchivos adjuntos: ${adjuntos.map(f => f.name).join(', ')}`
      : '';
    const ok = confirm(
      `Se enviará el mismo mensaje a ${grupos.length} grupo(s), usando la primera discusión visible de cada grupo.\n\n` +
      `Modo: ${usarHTML ? 'HTML' : 'Texto convertido a HTML'}${adjuntosInfo}\n\n¿Deseas continuar?`
    );
    if (!ok) return;

    runBtn.disabled = true;
    runBtn.textContent = 'Enviando...';
    status.textContent = 'Iniciando envío...';

    const resultados = [];
    const baseViewUrl = new URL(window.location.href);

    try {
      for (let i = 0; i < grupos.length; i++) {
        const grupo = grupos[i];
        status.textContent = `Procesando ${i + 1} de ${grupos.length}: ${grupo.nombre}`;

        try {
          const result = await sendMessageToGroup({
            grupo,
            baseViewUrl,
            subject,
            message,
            usarHTML,
            adjuntos
          });

          resultados.push({
            grupo: grupo.nombre,
            ok: true,
            detalle: result
          });
        } catch (error) {
          console.error('Error en grupo', grupo.nombre, error);
          resultados.push({
            grupo: grupo.nombre,
            ok: false,
            detalle: error.message || 'Error desconocido'
          });
        }

        await sleep(700);
      }

      const okCount = resultados.filter(r => r.ok).length;
      const failCount = resultados.filter(r => !r.ok).length;

      status.innerHTML = `
        <div><strong>Finalizado.</strong></div>
        <div>Enviados correctamente: ${okCount}</div>
        <div>Con error: ${failCount}</div>
      `;

      console.table(resultados);
      alert(`Proceso finalizado.\nCorrectos: ${okCount}\nErrores: ${failCount}\n\nRevisa la consola para el detalle.`);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Enviar ahora';
    }
  }

  async function sendMessageToGroup({ grupo, baseViewUrl, subject, message, usarHTML, adjuntos }) {
    const groupViewUrl = new URL(baseViewUrl);
    groupViewUrl.searchParams.set('group', grupo.id);

    // 1. Abrir view.php del grupo
    const resView = await fetch(groupViewUrl.toString(), { credentials: 'include' });
    if (!resView.ok) {
      throw new Error(`No se pudo abrir view.php del grupo (${resView.status})`);
    }

    const htmlView = await resView.text();
    const docView = new DOMParser().parseFromString(htmlView, 'text/html');

    // 2. Tomar la primera discusión visible
    const firstDiscussionLink = docView.querySelector('tr.discussion th.topic a');
    if (!firstDiscussionLink?.href) {
      throw new Error('No se encontró una discusión visible en este grupo.');
    }

    const discussUrl = firstDiscussionLink.href;

    // 3. Abrir la discusión
    const resDiscuss = await fetch(discussUrl, { credentials: 'include' });
    if (!resDiscuss.ok) {
      throw new Error(`No se pudo abrir discuss.php (${resDiscuss.status})`);
    }

    const htmlDiscuss = await resDiscuss.text();
    const docDiscuss = new DOMParser().parseFromString(htmlDiscuss, 'text/html');

    // 4. Tomar el último enlace real de responder
    const replyLinks = Array.from(docDiscuss.querySelectorAll('a.btn.btn-link'))
      .filter(a =>
        (a.textContent || '').trim() === 'Responder' &&
        a.href.includes('/mod/forum/post.php?reply=')
      );

    if (!replyLinks.length) {
      throw new Error('No se encontró enlace real de Responder en la discusión.');
    }

    const replyUrl = replyLinks[replyLinks.length - 1].href;

    // 5. Abrir el formulario real de respuesta
    const resReply = await fetch(replyUrl, { credentials: 'include' });
    if (!resReply.ok) {
      throw new Error(`No se pudo abrir post.php de respuesta (${resReply.status})`);
    }

    const htmlReply = await resReply.text();
    const docReply = new DOMParser().parseFromString(htmlReply, 'text/html');

    const form = docReply.querySelector('form#mformforum');
    if (!form) {
      throw new Error('No se encontró el formulario real de respuesta.');
    }

    const formData = new FormData(form);

    const discussion = formData.get('discussion');
    const parent = formData.get('parent');
    const reply = formData.get('reply');

    if (!discussion || !parent || !reply || discussion === '0' || parent === '0' || reply === '0') {
      throw new Error('El formulario no tiene contexto válido de réplica.');
    }

    // 6. Llenar asunto y mensaje
    if (subject) {
      formData.set('subject', subject);
    } else if (!String(formData.get('subject') || '').trim()) {
      formData.set('subject', 'Re: seguimiento');
    }

    const contenidoFinal = usarHTML ? message : plainTextToHtml(message);

    formData.set('message[text]', contenidoFinal);
    formData.set('message[format]', '1');

    // 7. Subir adjuntos al área de borrador si existen
    if (adjuntos.length) {
      const draftItemId = formData.get('attachments');
      const sesskey = formData.get('sesskey');

      if (!draftItemId || draftItemId === '0') {
        throw new Error('No se encontró el área de borrador (attachments/draftitemid) para adjuntos.');
      }

      // Extraer contextid del documento de respuesta (múltiples fuentes)
      const contextId =
        docReply.querySelector('input[name="context"]')?.value ||
        docReply.querySelector('input[name="contextid"]')?.value ||
        docReply.body?.dataset?.coreContextid ||
        (() => { const m = htmlReply.match(/"contextid"\s*:\s*(\d+)/); return m?.[1]; })();

      const basePath = form.action.replace(/\/mod\/forum\/post\.php.*/, '');
      const uploadUrl = `${basePath}/repository/ajax/uploader.php`;

      for (const archivo of adjuntos) {
        const uploadData = new FormData();
        uploadData.append('action',           'upload');
        uploadData.append('sesskey',          sesskey);
        uploadData.append('repo_id',          '4');
        uploadData.append('itemid',           draftItemId);
        uploadData.append('savepath',         '/');
        uploadData.append('maxbytes',         formData.get('maxbytes') || '-1');
        uploadData.append('areamaxbytes',     formData.get('areamaxbytes') || '-1');
        if (contextId) uploadData.append('ctx_id', contextId);
        uploadData.append('repo_upload_file', archivo, archivo.name);

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          body: uploadData,
          credentials: 'include'
        });

        if (!uploadRes.ok) {
          throw new Error(`No se pudo subir "${archivo.name}" (HTTP ${uploadRes.status})`);
        }

        const uploadJson = await uploadRes.json().catch(() => null);
        if (uploadJson?.error) {
          throw new Error(`Moodle rechazó "${archivo.name}": ${uploadJson.error}`);
        }
      }
    }

    // 8. Enviar POST real
    const postRes = await fetch(form.action, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!postRes.ok) {
      throw new Error(`POST final rechazado (${postRes.status})`);
    }

    return {
      discussUrl,
      replyUrl,
      discussion,
      parent,
      reply
    };
  }

  function plainTextToHtml(text) {
    return String(text)
      .split(/\n{2,}/)
      .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function smallBtn(bg, color, border) {
    return [
      `background:${bg}`,
      `color:${color}`,
      `border:1px solid ${border}`,
      'border-radius:8px',
      'padding:8px 12px',
      'font-size:12px',
      'cursor:pointer'
    ].join(';');
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();