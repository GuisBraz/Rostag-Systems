/* Utilitários de interface: escape de HTML, modal, aviso (toast) e avatar. */

import { t } from '../i18n.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function iniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/);
  return ((partes[0] || '')[0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/** Foto aceita no avatar: só imagens embutidas (data URL) geradas pelo próprio app. */
const FOTO_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Avatar de uma pessoa: a foto, se tiver; senão as iniciais. Aceita a pessoa ou só o nome. */
export function avatar(pessoa, extra = '') {
  const nome = typeof pessoa === 'string' ? pessoa : (pessoa && pessoa.nome) || '?';
  const foto = pessoa && typeof pessoa === 'object' && typeof pessoa.foto === 'string' && FOTO_OK.test(pessoa.foto) ? pessoa.foto : '';
  if (foto) return `<img class="avatar avatar-foto ${extra}" src="${foto}" alt="" title="${esc(nome)}">`;
  return `<span class="avatar ${extra}" title="${esc(nome)}">${esc(iniciais(nome))}</span>`;
}

/* ---- Aviso rápido ---- */
let timerAviso = null;
export function aviso(texto, tipo = 'ok') {
  let el = $('#aviso');
  if (!el) { el = document.createElement('div'); el.id = 'aviso'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = texto;
  el.className = `aviso aviso-${tipo} visivel`;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('visivel'), 2800);
}

export function erro(e) {
  console.error(e);
  const msg = (e && e.code === 'permission-denied') ? t('Você não tem permissão para isso.') : t((e && e.message) || 'Algo deu errado.');
  aviso(msg, 'erro');
}

/* ---- Modal ----
   `render()` devolve o HTML do conteúdo; é chamado de novo sempre que os dados
   mudam (ao vivo), preservando o que a pessoa está digitando. */
let modalAtual = null;

export function abrirModal({ render, eventos = {}, largo = false }) {
  fecharModal();
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `<div class="modal ${largo ? 'modal-largo' : ''}" role="dialog" aria-modal="true"></div>`;
  document.body.append(fundo);
  document.body.classList.add('sem-rolagem');
  const caixa = $('.modal', fundo);
  modalAtual = { fundo, caixa, render };
  // Eventos delegados, ligados uma vez só (o conteúdo é redesenhado ao vivo).
  Object.entries(eventos).forEach(([tipo, fn]) => caixa.addEventListener(tipo, fn));
  fundo.addEventListener('mousedown', (ev) => { if (ev.target === fundo) fecharModal(); });
  atualizarModal();
  const foco = $('[autofocus]', caixa) || $('input, textarea, select, button', caixa);
  if (foco) foco.focus();
}

export function atualizarModal() {
  if (!modalAtual) return;
  const { caixa, render } = modalAtual;
  // Guarda rascunhos e foco antes de redesenhar.
  // Só o campo em edição e os rascunhos (data-rascunho) são mantidos; o resto
  // mostra o valor mais recente do banco (pode ter sido mudado por outra pessoa).
  const rascunhos = {};
  const ativoEl = document.activeElement && caixa.contains(document.activeElement) ? document.activeElement : null;
  $$('[data-guardar]', caixa).forEach((el) => {
    if (el === ativoEl || el.hasAttribute('data-rascunho')) rascunhos[el.dataset.guardar] = el.value;
  });
  const focado = ativoEl ? ativoEl.dataset.guardar : null;
  const rolagem = caixa.scrollTop;
  const html = render();
  if (html === null) { fecharModal(); return; }
  caixa.innerHTML = html;
  Object.entries(rascunhos).forEach(([k, v]) => { const el = $(`[data-guardar="${k}"]`, caixa); if (el) el.value = v; });
  if (focado) { const el = $(`[data-guardar="${focado}"]`, caixa); if (el) el.focus(); }
  caixa.scrollTop = rolagem;
}

export function fecharModal() {
  if (!modalAtual) return;
  // Tira o foco antes de remover: campos que salvam ao sair (ex.: prazo) ainda salvam.
  const ativoEl = document.activeElement;
  if (ativoEl && modalAtual.caixa.contains(ativoEl)) ativoEl.blur();
  if (!modalAtual) return;
  modalAtual.fundo.remove();
  modalAtual = null;
  document.body.classList.remove('sem-rolagem');
}

export const modalAberto = () => !!modalAtual;

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modalAtual) fecharModal(); });

export function confirmar(texto) { return window.confirm(texto); }

/** Copia texto para a área de transferência (com plano B para navegadores antigos). */
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}
