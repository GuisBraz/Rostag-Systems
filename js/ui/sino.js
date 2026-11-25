/* Sino de notificações: contador de não lidas, painel com as recentes e aviso do
   Windows/celular (Notification API) enquanto o site estiver aberto. */

import { estado, fonte, nomeDe, pessoaDe } from '../estado.js';
import { notificacoesDe, naoLidas, podeVerTarefa } from '../dominio/regras.js';
import { t } from '../i18n.js';
import { esc, avatar, erro } from './base.js';
import { abrirTarefa } from './tarefas.js';

const SVG_SINO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-1.7 1.7A1 1 0 0 0 4 19.4h16a1 1 0 0 0 .7-1.7Z"/></svg>';

let aberto = false;
let documentoLigado = false;
const vistos = new Set();       // ids já conhecidos (para não repetir aviso do Windows)
let primeiraCarga = true;

/* ------------------------------------------------------------------ textos */

const TEXTO_PROJETO = {
  criou: '{quem} criou o projeto {p}', editou: '{quem} editou o projeto {p}', pausar: '{quem} pausou o projeto {p}',
  retomar: '{quem} retomou o projeto {p}', finalizar: '{quem} finalizou o projeto {p}', cancelar: '{quem} cancelou o projeto {p}',
  reabrir: '{quem} reabriu o projeto {p}', excluir: '{quem} excluiu o projeto {p}', restaurar: '{quem} restaurou o projeto {p}',
  apagar: '{quem} apagou de vez o projeto {p}'
};

export function textoNotificacao(n) {
  const quem = nomeDe(n.por);
  if (n.tipo === 'projeto') return t(TEXTO_PROJETO[n.acao] || '{quem} alterou o projeto {p}', { quem, p: n.titulo });
  if (n.tipo === 'tarefa_nova') return t('{quem} criou a tarefa {tarefa}', { quem, tarefa: n.titulo });
  if (n.tipo === 'tarefa_atribuida') return t('{quem} passou a tarefa {tarefa} para você', { quem, tarefa: n.titulo });
  if (n.tipo === 'comentario') return t('{quem} comentou em {tarefa}: “{trecho}”', { quem, tarefa: n.titulo, trecho: n.trecho || '' });
  return quem;
}

export function tempoAtras(ms, agora = Date.now()) {
  const min = Math.floor((agora - ms) / 60000);
  if (min < 1) return t('agora');
  if (min < 60) return t('há {n} min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('há {n} h', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t('ontem') : t('há {n} dias', { n: d });
}

/* ------------------------------------------------------------------ tela */

export function htmlSino() {
  const n = naoLidas(estado.usuario, estado.notificacoes);
  return `${SVG_SINO}${n ? `<span class="sino-num">${n > 99 ? '99+' : n}</span>` : ''}`;
}

function htmlPainel() {
  const u = estado.usuario;
  const lista = notificacoesDe(u, estado.notificacoes).slice(0, 40);
  const vistasEm = u.notifVistasEm || 0;
  const temApi = 'Notification' in window;
  const perm = temApi ? Notification.permission : 'denied';
  return `
    <div class="notif-topo">
      <strong>${esc(t('Notificações'))}</strong>
      ${lista.some((n) => n.em > vistasEm) ? `<button type="button" class="botao-link" data-marcar-lidas>${esc(t('Marcar todas como lidas'))}</button>` : ''}
    </div>
    <ul class="notif-lista">
      ${lista.map((n) => `
        <li><button type="button" class="notif-item ${n.em > vistasEm ? 'nao-lida' : ''}" data-notif="${esc(n.id)}">
          ${avatar(pessoaDe(n.por), 'avatar-p')}
          <span class="notif-texto">${esc(textoNotificacao(n))}<small>${esc(tempoAtras(n.em))}</small></span>
        </button></li>`).join('') || `<li class="vazio">${esc(t('Nenhuma notificação por enquanto.'))}</li>`}
    </ul>
    <div class="notif-rodape">
      ${!temApi ? '' : perm === 'granted' ? `<span class="meta">✓ ${esc(t('Avisos do Windows/celular ativados'))}</span>`
        : perm === 'denied' ? `<span class="meta">${esc(t('Avisos bloqueados nas configurações do navegador.'))}</span>`
          : `<button type="button" class="botao-sec" data-ativar-avisos>${esc(t('Ativar avisos no Windows/celular'))}</button>`}
    </div>`;
}

function marcarLidas() {
  const u = estado.usuario;
  const ultima = Math.max(0, ...notificacoesDe(u, estado.notificacoes).map((n) => n.em));
  if (ultima > (u.notifVistasEm || 0)) fonte.atualizarUsuario(u.id, { notifVistasEm: Date.now() }).catch(erro);
}

function irPara(n) {
  if (n.tarefaId) {
    const tarefa = estado.tarefas.find((x) => x.id === n.tarefaId);
    if (tarefa && podeVerTarefa(estado.usuario, tarefa)) { abrirTarefa(n.tarefaId); return; }
  }
  if (n.projetoId) location.hash = `#/projetos/${n.projetoId}`;
}

function fecharPainel() {
  const painel = document.getElementById('painel-notif');
  if (!painel || !aberto) return;
  aberto = false;
  painel.hidden = true;
  marcarLidas(); // quem abriu o painel viu as notificações
}

/** Liga o sino (uma vez, quando a casca é montada). */
export function montarSino() {
  const botao = document.getElementById('sino');
  const painel = document.getElementById('painel-notif');
  botao.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (aberto) { fecharPainel(); return; }
    aberto = true;
    painel.innerHTML = htmlPainel();
    painel.hidden = false;
  });
  painel.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (ev.target.closest('[data-marcar-lidas]')) { marcarLidas(); return; }
    if (ev.target.closest('[data-ativar-avisos]')) {
      Notification.requestPermission().then(() => { painel.innerHTML = htmlPainel(); });
      return;
    }
    const item = ev.target.closest('[data-notif]');
    if (item) {
      const n = estado.notificacoes.find((x) => x.id === item.dataset.notif);
      fecharPainel();
      if (n) irPara(n);
    }
  });
  if (documentoLigado) return;
  documentoLigado = true;
  document.addEventListener('click', () => fecharPainel());
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharPainel(); });
}

/** A cada mudança de dados: atualiza contador/painel e mostra aviso do Windows das novas. */
export function atualizarSino() {
  const botao = document.getElementById('sino');
  if (!botao) return;
  const n = naoLidas(estado.usuario, estado.notificacoes);
  botao.innerHTML = htmlSino();
  botao.setAttribute('aria-label', `${t('Notificações')}${n ? ` (${n})` : ''}`);
  const painel = document.getElementById('painel-notif');
  if (aberto && painel) painel.innerHTML = htmlPainel();
  avisarNovas();
}

function avisarNovas() {
  const lista = notificacoesDe(estado.usuario, estado.notificacoes);
  const novas = lista.filter((n) => !vistos.has(n.id));
  novas.forEach((n) => vistos.add(n.id));
  if (primeiraCarga) { primeiraCarga = false; return; } // não avisa o que já existia ao abrir o site
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden && document.hasFocus()) return; // quem está olhando a tela já vê o sino
  novas.filter((n) => n.em > (estado.usuario.notifVistasEm || 0)).slice(0, 3).forEach((n) => {
    try {
      const aviso = new Notification('Rostag Systems', { body: textoNotificacao(n), icon: 'img/icone-192.png', tag: n.id });
      aviso.onclick = () => { window.focus(); irPara(n); aviso.close(); };
    } catch { /* alguns celulares só permitem aviso via service worker */ }
  });
}

/** Ao trocar de pessoa (demo) ou sair, recomeça a contagem de "já vistos". */
export function reiniciarSino() { vistos.clear(); primeiraCarga = true; aberto = false; }
