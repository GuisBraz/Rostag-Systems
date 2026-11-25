/* Aviso de nova versão: de tempos em tempos (e quando a pessoa volta para a aba)
   confere o version.json publicado. Se for diferente da versão carregada, mostra
   uma faixa com o botão "Recarregar", que busca os arquivos novos sem cache. */

import { VERSAO } from './config.js';
import { t } from './i18n.js';
import { esc } from './ui/base.js';

const INTERVALO_MS = 2 * 60 * 1000;
let avisado = false;

async function versaoPublicada() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()).versao || null;
  } catch { return null; }
}

async function conferir() {
  if (avisado || document.hidden) return;
  const v = await versaoPublicada();
  if (v && v !== VERSAO) mostrarAviso(v);
}

/** Atualiza no cache do navegador todos os arquivos deste site que a página carregou, e recarrega. */
export async function recarregarSemCache() {
  const urls = new Set([location.pathname]);
  performance.getEntriesByType('resource').forEach((e) => {
    try { const u = new URL(e.name); if (u.origin === location.origin) urls.add(u.pathname); } catch { /* ignora */ }
  });
  await Promise.all([...urls].map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
  location.reload();
}

function mostrarAviso(v) {
  avisado = true;
  const el = document.createElement('div');
  el.className = 'aviso-versao';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(t('Nova versão disponível ({v}).', { v }))}</span>
    <button type="button" class="botao" data-recarregar>${esc(t('Recarregar'))}</button>
    <button type="button" class="botao-icone" data-depois aria-label="${esc(t('Depois'))}" title="${esc(t('Depois'))}">×</button>`;
  el.querySelector('[data-recarregar]').addEventListener('click', (ev) => {
    ev.currentTarget.disabled = true;
    ev.currentTarget.textContent = t('Atualizando…');
    recarregarSemCache();
  });
  // "Depois": some agora e volta a avisar na próxima conferência.
  el.querySelector('[data-depois]').addEventListener('click', () => { el.remove(); avisado = false; });
  document.body.append(el);
}

export function vigiarAtualizacoes() {
  setInterval(conferir, INTERVALO_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) conferir(); });
  setTimeout(conferir, 5000);
}
