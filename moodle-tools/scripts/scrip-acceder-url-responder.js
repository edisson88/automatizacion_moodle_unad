(() => {
  console.log('Extrayendo respuestas con autor...');

  const posts = Array.from(document.querySelectorAll('[data-region-content="forum-post-core"]'));

  const resultados = posts.map((post, index) => {
    // 🔹 Autor
    const autor =
      (post.querySelector('header a')?.textContent || '').trim() ||
      (post.querySelector('.author a')?.textContent || '').trim() ||
      (post.querySelector('.author')?.textContent || '').trim() ||
      'No identificado';

    // 🔹 Mensaje (preview corto)
    const mensaje =
      (post.querySelector('.text_to_html')?.textContent || '').trim().slice(0, 120);

    // 🔹 Botón responder
    const replyLink = post.querySelector('a[href*="reply="]');

    const replyUrl = replyLink?.href || '';
    const replyIdMatch = replyUrl.match(/[?&]reply=(\d+)/);
    const replyId = replyIdMatch ? replyIdMatch[1] : '';

    return {
      index,
      autor,
      mensaje,
      replyId,
      replyUrl
    };
  });

  console.table(resultados);
})();