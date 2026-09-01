chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'OFFSCREEN_COPY') return;

  (async () => {
    const text = String(message.text || '');
    let ok = false;
    let errorMessage = '';

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      ok = document.execCommand('copy');
      textarea.remove();
    } catch (error) {
      errorMessage = error?.message || String(error);
    }

    if (!ok) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (error) {
        errorMessage = error?.message || errorMessage || String(error);
      }
    }

    sendResponse({ ok, error: ok ? undefined : (errorMessage || 'Falha ao copiar para a área de transferência.') });
  })();

  return true;
});
