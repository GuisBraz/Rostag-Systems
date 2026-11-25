/* Linha do tempo vertical dos projetos em aberto, ordenada pela data de entrega.
   Cada escopo é um item; um marcador mostra onde está "hoje". */

import { estado } from '../estado.js';
import { projetoAberto, projetoEhMeu, situacaoPeriodo, atrasada } from '../dominio/regras.js';
import { fmtData, hojeISO } from '../dominio/datas.js';
import { t as T, idioma } from '../i18n.js';
import { esc } from './base.js';
import { progresso, responsaveisHtml, seloSituacao } from './projetos.js';

let filtro = 'todos'; // 'todos' | 'meus'

function nomeMes(iso) {
  const [a, m] = iso.split('-').map(Number);
  const txt = new Intl.DateTimeFormat(idioma() === 'en' ? 'en-US' : 'pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(a, m - 1, 1));
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function textoSituacao(s) {
  if (s.tipo === 'atrasado') return T('Atrasado {n} dia(s)', { n: s.dias });
  if (s.tipo === 'futuro') return T('Começa em {n} dia(s)', { n: s.dias });
  if (s.tipo === 'andamento') return s.dias === 0 ? T('Entrega hoje') : T('Faltam {n} dia(s)', { n: s.dias });
  return '';
}

function item(p) {
  const s = situacaoPeriodo(p);
  const tarefas = estado.tarefas.filter((t) => t.projetoId === p.id);
  const pr = progresso(tarefas);
  const atras = tarefas.filter((t) => atrasada(t)).length;
  return `
    <li class="linha-item sit-${s.tipo} ${p.status === 'pausado' ? 'linha-pausado' : ''}">
      <div class="li-data"><strong>${esc(fmtData(p.prazo))}</strong><small>${esc(T('entrega'))}</small></div>
      <span class="li-ponto" aria-hidden="true"></span>
      <a class="li-card" href="#/projetos/${esc(p.id)}">
        <div class="li-topo">
          ${p.commessa ? `<span class="cp-commessa">${esc(p.commessa)}</span>` : ''}
          <span class="li-sit">${p.status === 'pausado' ? seloSituacao(p) : esc(textoSituacao(s))}</span>
        </div>
        <h3>${esc(p.nome)}</h3>
        ${p.cliente || p.tipoServico ? `<p class="li-cliente">${esc([p.cliente, p.tipoServico].filter(Boolean).join(' · '))}</p>` : ''}
        <div class="li-periodo">
          <span>${esc(p.inicio ? fmtData(p.inicio) : '—')}</span>
          <div class="li-tempo" title="${esc(T('Tempo decorrido'))}: ${s.pct}%"><span style="width:${s.pct}%"></span></div>
          <span>${esc(fmtData(p.prazo))}</span>
        </div>
        <div class="li-rodape">
          ${responsaveisHtml(p)}
          <span>${esc(T('{p}% das tarefas concluídas', { p: pr.pct }))} (${pr.feitas}/${pr.total})</span>
          ${atras ? `<span class="prazo atrasada">${esc(T('{n} atrasada(s)', { n: atras }))}</span>` : ''}
        </div>
      </a>
    </li>`;
}

export function renderLinha() {
  const eu = estado.usuario;
  const abertos = estado.projetos.filter(projetoAberto);
  const lista = abertos
    .filter((p) => filtro === 'todos' || projetoEhMeu(eu, p))
    .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  const hoje = hojeISO();

  let html = '';
  let mesAtual = '';
  let hojeMarcado = false;
  const marcadorHoje = `<li class="linha-hoje"><span>${esc(T('Hoje'))} · ${esc(fmtData(hoje))}</span></li>`;
  lista.forEach((p) => {
    if (!hojeMarcado && p.prazo && p.prazo >= hoje) { html += marcadorHoje; hojeMarcado = true; }
    const mes = p.prazo ? p.prazo.slice(0, 7) : 'sem';
    if (mes !== mesAtual) {
      mesAtual = mes;
      html += `<li class="linha-mes"><span>${esc(mes === 'sem' ? T('Sem data de entrega') : nomeMes(mes))}</span></li>`;
    }
    html += item(p);
  });
  if (!hojeMarcado && lista.length) html += marcadorHoje;

  const seg = (v, rotulo) => `<button type="button" class="seg ${filtro === v ? 'ativo seg-andamento' : ''}" data-filtro-linha="${v}" aria-pressed="${filtro === v}">${esc(T(rotulo))}</button>`;
  return `
    <header class="titulo-pagina">
      <h1>${esc(T('Linha do tempo'))}</h1>
      <p>${esc(T('Projetos em aberto, pela data de entrega'))}</p>
      <div class="seg-status">${seg('todos', 'Todos')}${seg('meus', 'Só os meus')}</div>
    </header>
    ${lista.length ? `<ol class="linha">${html}</ol>`
      : `<p class="vazio">${esc(T(filtro === 'meus' ? 'Nenhum projeto em aberto com você como responsável.' : 'Nenhum projeto em aberto.'))}</p>`}`;
}

export function montarLinha(raiz, redesenhar) {
  raiz.querySelectorAll('[data-filtro-linha]').forEach((b) => b.addEventListener('click', () => {
    filtro = b.dataset.filtroLinha;
    redesenhar(false);
  }));
}
