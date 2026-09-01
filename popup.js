const $ = s => document.querySelector(s);
let history = [];
let onlyPinned = false;

init();

async function init() {
  const data = await chrome.storage.local.get(['history','settings']);
  history = data.history || [];
  $('#captureToggle').checked = data.settings?.captureEnabled !== false;

  // Sincroniza o texto atual do clipboard ao abrir o QuickKit.
  // Isso cobre páginas/abas em que o content script ainda não estava ativo.
  if (data.settings?.captureEnabled !== false) {
    try {
      const text = (await navigator.clipboard.readText())?.trim();
      if (text) {
        await chrome.runtime.sendMessage({ type:'SAVE_TEXT', text, source:'clipboard' });
        const refreshed = await chrome.storage.local.get('history');
        history = refreshed.history || history;
      }
    } catch (_) {
      // Alguns contextos do Chrome bloqueiam leitura do clipboard. O restante continua funcionando.
    }
  }
  render();
}

$('#search').addEventListener('input', render);
$('#filterAll').addEventListener('click', () => setFilter(false));
$('#filterPinned').addEventListener('click', () => setFilter(true));
$('#captureToggle').addEventListener('change', async e => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, captureEnabled: e.target.checked } });
});

$('#resourcesBtn').addEventListener('click', () => { $('#resourcesModal').hidden = false; });
$('#closeResources').addEventListener('click', () => { $('#resourcesModal').hidden = true; });
$('#resourcesModal').addEventListener('click', e => { if (e.target.id === 'resourcesModal') $('#resourcesModal').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#resourcesModal').hidden = true; });

$('#clearHistory').addEventListener('click', async () => {
  const keep = history.filter(x => x.pinned);
  history = keep;
  await chrome.storage.local.set({ history });
  render();
});

chrome.storage.onChanged.addListener(changes => {
  if (changes.history) { history = changes.history.newValue || []; render(); }
});

function setFilter(pinned) {
  onlyPinned = pinned;
  $('#filterAll').classList.toggle('active', !pinned);
  $('#filterPinned').classList.toggle('active', pinned);
  render();
}

function render() {
  const q = $('#search').value.trim().toLocaleLowerCase('pt-BR');
  const items = history.filter(x => (!onlyPinned || x.pinned) && (!q || x.text.toLocaleLowerCase('pt-BR').includes(q)));
  $('#list').innerHTML = '';
  $('#empty').hidden = items.length > 0;
  $('#counter').textContent = `${history.length} ${history.length === 1 ? 'item' : 'itens'}`;

  for (const item of items) {
    const el = document.createElement('article');
    el.className = 'item';
    el.title = 'Clique para copiar';
    const top = document.createElement('div'); top.className = 'itemtop';
    const text = document.createElement('div'); text.className = 'text'; text.textContent = item.text;
    const actions = document.createElement('div'); actions.className = 'actions';
    const pin = button(item.pinned ? '★' : '☆', item.pinned ? 'Desafixar' : 'Favoritar');
    pin.classList.add('pinbtn');
    const copy = button('⧉', 'Copiar');
    copy.classList.add('copybtn');
    const del = button('×', 'Excluir');
    pin.addEventListener('click', e => { e.stopPropagation(); togglePin(item.id); });
    copy.addEventListener('click', async e => { e.stopPropagation(); await copyItem(item, text); });
    del.addEventListener('click', e => { e.stopPropagation(); removeItem(item.id); });
    actions.append(copy, pin, del); top.append(text, actions);
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = `<span>${relative(item.createdAt)}</span><span>${sourceLabel(item.source)}</span>${item.pinned ? '<span class="badge">★ Favorito</span>' : ''}`;
    el.append(top, meta);
    el.addEventListener('click', async () => {
      await copyItem(item, text);
    });
    $('#list').appendChild(el);
  }
}


async function copyItem(item, textEl) {
  let copied = false;
  try {
    // Popup click carries a user activation, which is the most reliable way
    // to write to the clipboard in Chromium.
    await navigator.clipboard.writeText(item.text);
    copied = true;
  } catch (_) {}

  if (!copied) {
    try {
      const response = await chrome.runtime.sendMessage({ type:'COPY_TEXT', text:item.text });
      copied = response?.ok !== false;
    } catch (_) {}
  }

  const original = item.text;
  textEl.textContent = copied ? '✓ Copiado para colar' : '⚠ Não foi possível copiar';
  textEl.classList.toggle('copy-error', !copied);
  setTimeout(() => {
    textEl.textContent = original;
    textEl.classList.remove('copy-error');
  }, copied ? 900 : 1600);
}

function sourceLabel(source) {
  const labels = { tool:'Quick Tool', manual:'Salvo manualmente', clipboard:'Clipboard', copy:'Copiado' };
  return labels[source] || 'CopyBox';
}

function button(label, title) {
  const b = document.createElement('button'); b.className='iconbtn'; b.textContent=label; b.title=title; return b;
}
async function togglePin(id) {
  history = history.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x)
    .sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.createdAt-a.createdAt);
  await chrome.storage.local.set({ history }); render();
}
async function removeItem(id) {
  history = history.filter(x => x.id !== id); await chrome.storage.local.set({ history }); render();
}
function relative(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s/60)} min`;
  if (s < 86400) return `${Math.floor(s/3600)} h`;
  return `${Math.floor(s/86400)} d`;
}
