/* Rostag Systems — casca do app: login, menu, rotas e redesenho ao vivo. */

import { MODO_DEMO } from './config.js';
import { estado, fonte, aoMudar, iniciarEstado } from './estado.js';
import { NIVEIS, ehGerente, ativo } from './dominio/regras.js';
import { esc, $, avatar, atualizarModal, modalAberto, erro } from './ui/base.js';
import { renderInicio, montarInicio, desmontarInicio, primeiroNome } from './ui/inicio.js';
import { renderMinhas, renderQuadro, montarQuadro, novaTarefa, abrirTarefa } from './ui/tarefas.js';
import { renderProjetos, renderProjeto, formProjeto } from './ui/projetos.js';
import { renderEquipe, montarEquipe } from './ui/equipe.js';
import { saudacao, dataHoraCurta, semanaISO } from './dominio/datas.js';

const app = $('#app');

const ROTAS = [
  { id: 'inicio', nome: 'Início', render: renderInicio, montar: montarInicio },
  { id: 'minhas', nome: 'Minhas tarefas', render: renderMinhas },
  { id: 'quadro', nome: 'Quadro', render: renderQuadro, montar: montarQuadro },
  { id: 'projetos', nome: 'Projetos', render: renderProjetos },
  { id: 'equipe', nome: 'Equipe', render: renderEquipe, montar: montarEquipe, so: ehGerente }
];

function rotaAtual() {
  const [, id = 'inicio', param = ''] = (location.hash || '#/inicio').split('/');
  return { id, param: decodeURIComponent(param) };
}

/* ------------------------------------------------------------------ telas */

function telaCarregando() {
  app.innerHTML = '<div class="centro-tela"><div class="marca marca-grande">Rostag <span>Systems</span></div><p class="meta">Carregando…</p></div>';
}

function telaLogin() {
  let modo = 'entrar';
  const desenhar = (msg = '') => {
    const agora = new Date();
    app.innerHTML = `
      <div class="centro-tela">
        <div class="marca marca-grande">Rostag <span>Systems</span></div>
        <p class="meta" id="relogio-login">${esc(saudacao(agora))} · ${esc(dataHoraCurta(agora))} · Semana ${semanaISO(agora)}</p>
        <form class="cartao form form-login" id="form-login">
          <div class="abas" role="tablist">
            <button type="button" role="tab" class="${modo === 'entrar' ? 'ativo' : ''}" data-modo="entrar">Entrar</button>
            <button type="button" role="tab" class="${modo === 'criar' ? 'ativo' : ''}" data-modo="criar">Criar conta</button>
          </div>
          ${modo === 'criar' ? '<label>Nome<input name="nome" required maxlength="60" autocomplete="name"></label>' : ''}
          <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
          <label>Senha<input name="senha" type="password" required minlength="6" autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}"></label>
          ${msg ? `<p class="texto-alerta">${esc(msg)}</p>` : ''}
          <button class="botao">${modo === 'criar' ? 'Criar conta' : 'Entrar'}</button>
        </form>
      </div>`;
    app.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { modo = b.dataset.modo; desenhar(); }));
    $('#form-login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.target));
      try {
        if (modo === 'criar') await fonte.cadastrar(d.nome.trim(), d.email.trim(), d.senha);
        else await fonte.entrar(d.email.trim(), d.senha);
      } catch (e) {
        const msgs = {
          'auth/invalid-credential': 'E-mail ou senha incorretos.',
          'auth/wrong-password': 'E-mail ou senha incorretos.',
          'auth/user-not-found': 'E-mail ou senha incorretos.',
          'auth/email-already-in-use': 'Este e-mail já tem conta. Use “Entrar”.',
          'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres.'
        };
        desenhar(msgs[e.code] || e.message);
      }
    });
  };
  desenhar();
}

// Relógio da tela de login também fica sempre atualizado.
setInterval(() => {
  const el = document.getElementById('relogio-login');
  if (!el) return;
  const agora = new Date();
  el.textContent = `${saudacao(agora)} · ${dataHoraCurta(agora)} · Semana ${semanaISO(agora)}`;
}, 1000);

function telaPendente() {
  app.innerHTML = `
    <div class="centro-tela">
      <div class="marca marca-grande">Rostag <span>Systems</span></div>
      <h1>Olá ${esc(primeiroNome(estado.usuario.nome))}</h1>
      <p>Sua conta foi criada e está <strong>aguardando liberação da gerência</strong>.</p>
      <p class="meta">Assim que seu nível for definido, esta tela atualiza sozinha.</p>
      <button class="botao-sec" id="sair">Sair</button>
    </div>`;
  $('#sair').addEventListener('click', () => fonte.sair());
}

/* ------------------------------------------------------------------ casca */

let cascaMontada = false;
let rotaMontada = '';

function montarCasca() {
  app.innerHTML = `
    <header class="topo">
      <a class="marca" href="#/inicio">Rostag <span>Systems</span></a>
      <nav class="menu" id="menu" aria-label="Principal"></nav>
      <div class="usuario" id="usuario"></div>
    </header>
    ${MODO_DEMO ? `<div class="faixa-demo" id="faixa-demo"></div>` : ''}
    <main id="conteudo"></main>`;
  cascaMontada = true;
}

function desenharCasca() {
  const u = estado.usuario;
  const r = rotaAtual();
  $('#menu').innerHTML = ROTAS.filter((x) => !x.so || x.so(u)).map((x) =>
    `<a href="#/${x.id}" class="${r.id === x.id ? 'ativo' : ''}" ${r.id === x.id ? 'aria-current="page"' : ''}>${esc(x.nome)}</a>`).join('');
  $('#usuario').innerHTML = `${avatar(u.nome)}<div><strong>${esc(u.nome)}</strong><small>${esc(NIVEIS[u.nivel])}</small></div>
    ${MODO_DEMO ? '' : '<button class="botao-link" id="sair">Sair</button>'}`;
  const sair = $('#sair');
  if (sair) sair.addEventListener('click', () => fonte.sair());

  const faixa = $('#faixa-demo');
  if (faixa) {
    faixa.innerHTML = `<span><strong>Modo demonstração</strong> · dados só neste navegador. Ver como:</span>
      <select id="trocar-usuario" aria-label="Ver o sistema como">
        ${estado.usuarios.filter(ativo).map((x) => `<option value="${esc(x.id)}" ${x.id === u.id ? 'selected' : ''}>${esc(x.nome)} — ${esc(NIVEIS[x.nivel])}</option>`).join('')}
      </select>
      <button class="botao-link" id="restaurar-demo">Restaurar exemplo</button>`;
    $('#trocar-usuario').addEventListener('change', (ev) => fonte.trocarUsuario(ev.target.value));
    $('#restaurar-demo').addEventListener('click', () => { if (confirm('Apagar as mudanças e voltar aos dados de exemplo?')) fonte.restaurarDemo(); });
  }
}

function desenharPagina(manterFoco = true) {
  const r = rotaAtual();
  const u = estado.usuario;
  let rota = ROTAS.find((x) => x.id === r.id && (!x.so || x.so(u)));
  if (!rota) { location.hash = '#/inicio'; return; }

  // Guarda foco/cursor de um filtro em digitação para não perder ao redesenhar.
  const ativoEl = document.activeElement;
  const filtroFocado = manterFoco && ativoEl && ativoEl.dataset && ativoEl.dataset.filtro;
  const cursor = filtroFocado && ativoEl.selectionStart;
  const rolagem = window.scrollY;
  const chave = `${r.id}/${r.param}`;

  if (rotaMontada.startsWith('inicio') && r.id !== 'inicio') desmontarInicio();
  const conteudo = $('#conteudo');
  const pagina = document.createElement('div');
  pagina.className = `pagina pagina-${r.id}`;
  pagina.innerHTML = r.id === 'projetos' && r.param ? renderProjeto(r.param) : rota.render();
  conteudo.replaceChildren(pagina);
  if (rota.montar) rota.montar(pagina, (foco) => desenharPagina(foco));

  if (filtroFocado) {
    const el = pagina.querySelector(`[data-filtro="${filtroFocado}"]`);
    if (el) { el.focus(); if (cursor != null && el.setSelectionRange) el.setSelectionRange(cursor, cursor); }
  }
  if (chave === rotaMontada) window.scrollTo(0, rolagem); else window.scrollTo(0, 0);
  rotaMontada = chave;
}

function desenhar() {
  if (!estado.carregado) { telaCarregando(); cascaMontada = false; return; }
  if (!estado.usuario) { cascaMontada = false; desmontarInicio(); telaLogin(); return; }
  if (!ativo(estado.usuario)) { cascaMontada = false; desmontarInicio(); telaPendente(); return; }
  if (!cascaMontada) montarCasca();
  desenharCasca();
  desenharPagina();
  if (modalAberto()) atualizarModal();
}

/* ------------------------------------------------- ações globais (cliques) */

document.addEventListener('click', (ev) => {
  if (ev.target.closest('.modal')) return; // o modal trata os próprios cliques
  const abrir = ev.target.closest('[data-abrir-tarefa]');
  if (abrir) { abrirTarefa(abrir.dataset.abrirTarefa); return; }
  const nova = ev.target.closest('[data-nova-tarefa]');
  if (nova) { novaTarefa({ projetoId: nova.dataset.projeto || '' }); return; }
  if (ev.target.closest('[data-novo-projeto]')) { formProjeto(); return; }
  const editar = ev.target.closest('[data-editar-projeto]');
  if (editar) formProjeto(editar.dataset.editarProjeto);
});

document.addEventListener('keydown', (ev) => {
  // Enter/Espaço abre o cartão focado pelo teclado.
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('.card-tarefa[data-abrir-tarefa]')) {
    ev.preventDefault();
    abrirTarefa(ev.target.dataset.abrirTarefa);
  }
});

window.addEventListener('hashchange', () => { if (cascaMontada) { desenharCasca(); desenharPagina(false); } });

aoMudar(desenhar);
try { iniciarEstado(); } catch (e) { erro(e); app.innerHTML = `<div class="centro-tela"><p class="texto-alerta">${esc(e.message)}</p></div>`; }
desenhar();
// Os gráficos medem os rótulos com a fonte; redesenha quando a Inter terminar de carregar.
if (document.fonts) document.fonts.ready.then(() => { if (cascaMontada) desenharPagina(); });
