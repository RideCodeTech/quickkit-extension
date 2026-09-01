let quickKitContextSelection = null;

function isTextInput(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el.type || 'text').toLowerCase();
  return ['text', 'search', 'url', 'tel', 'email', 'password'].includes(type);
}

function captureSelectionFromTarget(target) {
  if (isTextInput(target)) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return {
        type: 'input',
        element: target,
        start,
        end,
        text: target.value.slice(start, end),
        capturedAt: Date.now()
      };
    }
  }

  const editable = target?.closest?.('[contenteditable="true"], [contenteditable=""]');
  if (editable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (editable.contains(range.commonAncestorContainer)) {
        return {
          type: 'contenteditable',
          element: editable,
          range: range.cloneRange(),
          text: selection.toString(),
          capturedAt: Date.now()
        };
      }
    }
  }

  return null;
}

// O ponto-chave: guardar o campo e a seleção ANTES do menu de contexto abrir.
document.addEventListener('contextmenu', event => {
  quickKitContextSelection = captureSelectionFromTarget(event.target);
}, true);

function getCurrentEditableSelection() {
  const active = document.activeElement;
  const direct = captureSelectionFromTarget(active);
  if (direct) return direct;

  const selection = window.getSelection();
  if (selection && selection.rangeCount && !selection.isCollapsed) {
    let node = selection.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const editable = node?.closest?.('[contenteditable="true"], [contenteditable=""]');
    if (editable) {
      const range = selection.getRangeAt(0);
      return {
        type: 'contenteditable',
        element: editable,
        range: range.cloneRange(),
        text: selection.toString(),
        capturedAt: Date.now()
      };
    }
  }
  return null;
}

function usableCachedSelection() {
  if (!quickKitContextSelection) return null;
  if (Date.now() - quickKitContextSelection.capturedAt > 15000) return null;
  if (!quickKitContextSelection.element?.isConnected) return null;
  return quickKitContextSelection;
}

function setNativeValue(element, value) {
  const prototype = element.tagName === 'TEXTAREA'
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor?.set) descriptor.set.call(element, value);
  else element.value = value;
}

function replaceInputSelection(data, text) {
  const el = data.element;
  if (!el?.isConnected || el.disabled || el.readOnly) return false;

  el.focus({ preventScroll: true });
  try { el.setSelectionRange(data.start, data.end); } catch (_) {}

  // Mantém histórico de desfazer e funciona bem na maioria dos editores nativos.
  try {
    if (document.execCommand('insertText', false, text)) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  } catch (_) {}

  // Fallback compatível com React/Vue e outros campos controlados.
  const oldValue = el.value;
  const nextValue = oldValue.slice(0, data.start) + text + oldValue.slice(data.end);
  setNativeValue(el, nextValue);
  const pos = data.start + text.length;
  try { el.setSelectionRange(pos, pos); } catch (_) {}
  el.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertReplacementText',
    data: text
  }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value === nextValue;
}

function replaceContentEditableSelection(data, text) {
  const el = data.element;
  const range = data.range;
  if (!el?.isConnected || !range) return false;

  try {
    el.focus({ preventScroll: true });
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Primeiro tenta inserção nativa para preservar melhor undo/editores.
    try {
      if (document.execCommand('insertText', false, text)) return true;
    } catch (_) {}

    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertReplacementText',
      data: text
    }));
    return true;
  } catch (_) {
    return false;
  }
}

function replaceEditableSelection(text) {
  const editable = usableCachedSelection() || getCurrentEditableSelection();
  if (!editable) return false;

  const replaced = editable.type === 'input'
    ? replaceInputSelection(editable, text)
    : replaceContentEditableSelection(editable, text);

  if (replaced) quickKitContextSelection = null;
  return replaced;
}

function showQuickKitToast(message, kind = 'success') {
  let toast = document.getElementById('__quickkit_toast__');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__quickkit_toast__';
    Object.assign(toast.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '2147483647',
      maxWidth: '360px',
      padding: '11px 15px',
      borderRadius: '10px',
      background: '#0b1220',
      color: '#fff',
      font: '600 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      boxShadow: '0 10px 28px rgba(0,0,0,.35)',
      border: '1px solid rgba(56,189,248,.35)',
      opacity: '0',
      transform: 'translateY(8px)',
      transition: 'opacity .16s ease, transform .16s ease',
      pointerEvents: 'none'
    });
    document.documentElement.appendChild(toast);
  }
  toast.style.borderColor = kind === 'warning' ? 'rgba(251,191,36,.55)' : 'rgba(56,189,248,.35)';
  toast.textContent = message;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  clearTimeout(window.__quickkitToastTimer);
  window.__quickkitToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
  }, 2300);
}

document.addEventListener('copy', () => {
  queueMicrotask(() => {
    const selected = window.getSelection()?.toString();
    const active = document.activeElement;
    let text = selected || '';

    if (!text && isTextInput(active)) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (typeof start === 'number' && typeof end === 'number' && end > start) {
        text = active.value.slice(start, end);
      }
    }

    if (text?.trim()) chrome.runtime.sendMessage({ type: 'CAPTURE_COPY', text }).catch(() => {});
  });
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'QUICKKIT_REPLACE_SELECTION') {
    const replaced = replaceEditableSelection(String(message.text || ''));
    if (replaced) {
      showQuickKitToast(message.label ? `✓ ${message.label}` : '✓ Texto atualizado');
    }
    sendResponse({ ok: true, replaced });
    return;
  }

  if (message?.type === 'QUICKKIT_TOAST') {
    showQuickKitToast(message.message || '✓ Concluído', message.kind || 'success');
    sendResponse({ ok: true });
  }
});
