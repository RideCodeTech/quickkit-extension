const MENU_ROOT = 'quickkit-root';
const MAX_HISTORY = 150;

const actions = {
  clean: {
    title: 'Limpar formatação',
    transform: text => text.replace(/\u00a0/g, ' ').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').trim()
  },
  upper: { title: 'MAIÚSCULAS', transform: text => text.toLocaleUpperCase('pt-BR') },
  lower: { title: 'minúsculas', transform: text => text.toLocaleLowerCase('pt-BR') },
  title: {
    title: 'Primeira Letra',
    transform: text => text.toLocaleLowerCase('pt-BR').replace(/(^|[\s\n])([\p{L}])/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR'))
  },
  spaces: { title: 'Remover espaços extras', transform: text => text.replace(/\s+/g, ' ').trim() },
  lines: { title: 'Remover quebras de linha', transform: text => text.replace(/\s*\n+\s*/g, ' ').trim() },
  numbers: { title: 'Extrair apenas números', transform: text => (text.match(/\d+/g) || []).join('') },
  emails: {
    title: 'Extrair e-mails',
    transform: text => [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].join('\n')
  },
  links: {
    title: 'Extrair links',
    transform: text => [...new Set(text.match(/https?:\/\/[^\s<>'\"]+/gi) || [])].join('\n')
  },
  count: { title: 'Contar caracteres', transform: text => `${text.length} caracteres` }
};

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ROOT, title: 'QuickKit', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'quickkit-save', parentId: MENU_ROOT, title: '📋 Salvar no CopyBox', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'quickkit-favorite', parentId: MENU_ROOT, title: '★ Salvar como favorito', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'quickkit-sep', parentId: MENU_ROOT, type: 'separator', contexts: ['selection'] });
    for (const [id, action] of Object.entries(actions)) {
      chrome.contextMenus.create({ id: `quickkit-tool-${id}`, parentId: MENU_ROOT, title: action.title, contexts: ['selection'] });
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  createMenus();
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: { captureEnabled: true, maxItems: MAX_HISTORY } });
});

chrome.runtime.onStartup.addListener(createMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId || '');
  const source = info.selectionText || '';
  if (!source.trim()) return;

  if (id === 'quickkit-save') {
    await saveHistory(source, 'manual', '', false);
    return;
  }
  if (id === 'quickkit-favorite') {
    await saveHistory(source, 'manual', '', true);
    return;
  }
  if (!id.startsWith('quickkit-tool-')) return;
  const actionId = id.replace('quickkit-tool-', '');
  const action = actions[actionId];
  if (!action) return;
  const result = action.transform(source);
  if (!result && actionId !== 'count') return;

  let replaced = false;
  if (tab?.id && actionId !== 'count') {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'QUICKKIT_REPLACE_SELECTION',
        text: result,
        label: `${action.title} aplicado`
      });
      replaced = !!response?.replaced;
    } catch (_) {}
  }

  if (!replaced) {
    await copyToClipboard(result);
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'QUICKKIT_TOAST',
          message: actionId === 'count' ? `✓ ${result}` : `✓ ${action.title}: não era um campo editável, então copiei o resultado`
        });
      } catch (_) {}
    }
  }

  await saveHistory(result, 'tool');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // IMPORTANT: OFFSCREEN_COPY belongs exclusively to offscreen.js.
  // Returning true here for unknown messages can steal/hold the response channel
  // and make context-menu tools look like they stopped working.
  const type = message?.type;
  if (!['CAPTURE_COPY', 'SAVE_TEXT', 'COPY_TEXT'].includes(type)) return false;

  (async () => {
    if (type === 'CAPTURE_COPY') {
      const { settings = {} } = await chrome.storage.local.get('settings');
      if (settings.captureEnabled !== false) await saveHistory(message.text, 'copy', sender.tab?.url || '');
      sendResponse({ ok: true });
      return;
    }
    if (type === 'SAVE_TEXT') {
      await saveHistory(message.text, message.source || 'manual', message.url || '', !!message.pinned);
      sendResponse({ ok: true });
      return;
    }
    if (type === 'COPY_TEXT') {
      await copyToClipboard(message.text || '');
      sendResponse({ ok: true });
    }
  })().catch(err => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});

async function saveHistory(text, source = 'copy', url = '', forcePinned = false) {
  const clean = String(text || '').trim();
  if (!clean || clean.length > 100000) return;

  const { history = [], settings = {} } = await chrome.storage.local.get(['history', 'settings']);
  const maxItems = Number(settings.maxItems || MAX_HISTORY);
  const now = Date.now();
  const existingIndex = history.findIndex(item => item.text === clean);
  let pinned = !!forcePinned;
  if (existingIndex >= 0) {
    pinned = pinned || !!history[existingIndex].pinned;
    history.splice(existingIndex, 1);
  }
  history.unshift({ id: crypto.randomUUID(), text: clean, source, url, pinned, createdAt: now });

  const pinnedItems = history.filter(x => x.pinned);
  const normalItems = history.filter(x => !x.pinned).slice(0, Math.max(0, maxItems - pinnedItems.length));
  await chrome.storage.local.set({ history: [...pinnedItems, ...normalItems].sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.createdAt-a.createdAt) });
}

async function copyToClipboard(text) {
  const path = 'offscreen.html';
  const offscreenUrl = chrome.runtime.getURL(path);

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (!contexts.length) {
    try {
      await chrome.offscreen.createDocument({
        url: path,
        reasons: ['CLIPBOARD'],
        justification: 'Copiar o texto solicitado pelo usuário para a área de transferência.'
      });
    } catch (error) {
      // If another invocation created it between getContexts and createDocument,
      // continuing is safe.
      if (!String(error?.message || error).toLowerCase().includes('single offscreen')) throw error;
    }
  }

  const response = await Promise.race([
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_COPY', text: String(text ?? '') }),
    new Promise(resolve => setTimeout(() => resolve({ ok: false, error: 'Tempo limite ao copiar.' }), 2500))
  ]);

  if (!response?.ok) throw new Error(response?.error || 'Não foi possível copiar.');
  return true;
}
