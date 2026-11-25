/* Rostag Systems — casca do app: login, convite, menu, rotas e redesenho ao vivo. */

import { MODO_DEMO, LINKS } from './config.js';
import { estado, fonte, aoMudar, iniciarEstado } from './estado.js';
import { NIVEIS, ativo, conviteValido } from './dominio/regras.js';
import { t } from './i18n.js';
import { aplicarTema } from './prefs.js';
import { esc, $, avatar, atualizarModal, modalAberto, fecharModal, erro, aviso } from './ui/base.js';
import { renderInicio, montarInicio, desmontarInicio, primeiroNome } from './ui/inicio.js';
import { renderMinhas, renderQuadro, montarQuadro, novaTarefa, abrirTarefa } from './ui/tarefas.js';
import { renderProjetos, renderProjeto, formProjeto } from './ui/projetos.js';
import { renderConfig, montarConfig } from './ui/config.js';
import { renderLinha, montarLinha } from './ui/linha.js';
import { vigiarAtualizacoes } from './atualizacao.js';
import { saudacao, dataHoraCurta, semanaISO } from './dominio/datas.js';

aplicarTema();
const app = $('#app');

const ROTAS = [
  { id: 'inicio', nome: 'Início', render: renderInicio, montar: montarInicio },
  { id: 'minhas', nome: 'Minhas tarefas', render: renderMinhas },
  { id: 'quadro', nome: 'Quadro', render: renderQuadro, montar: montarQuadro },
  { id: 'projetos', nome: 'Projetos', render: (p) => (p ? renderProjeto(p) : renderProjetos()) },
  { id: 'linha', nome: 'Linha do tempo', render: renderLinha, montar: montarLinha },
  { id: 'config', nome: 'Configurações', render: (p) => renderConfig(p), montar: montarConfig, oculto: true }
];

function rotaAtual() {
  const [, id = 'inicio', param = ''] = (location.hash || '#/inicio').split('/');
  return { id, param: decodeURIComponent(param) };
}

/* ------------------------------------------------------------------ convite */

const CHAVE_CONVITE = 'rostag-systems-convite';
function guardarConviteDaUrl() {
  const r = rotaAtual();
  if (r.id === 'convite' && r.param) {
    try { sessionStorage.setItem(CHAVE_CONVITE, r.param); } catch { /* sem storage */ }
    history.replaceState(null, '', `${location.pathname}#/inicio`);
  }
}
function codigoConvite() { try { return sessionStorage.getItem(CHAVE_CONVITE); } catch { return null; } }
function esquecerConvite() { try { sessionStorage.removeItem(CHAVE_CONVITE); } catch { /* sem storage */ } }

/* ------------------------------------------------------------------ rodapé */

function desenharRodape() {
  let el = $('#rodape');
  if (!el) { el = document.createElement('footer'); el.id = 'rodape'; el.className = 'rodape-autor'; document.body.append(el); }
  el.innerHTML = `${esc(t('Desenvolvido por'))} <a href="${esc(LINKS.linkedin)}" target="_blank" rel="noopener noreferrer">Guilherme dos Santos Braz</a>
    <span class="rodape-cargo">${esc(t('— Técnico de processos e estudante de engenharia mecânica'))}</span> ·
    <a href="${esc(LINKS.portfolio)}" target="_blank" rel="noopener noreferrer">${esc(t('Portfólio'))}</a>`;
}

/* ------------------------------------------------------------------ telas */

const linhaRelogio = (agora) => `${t(saudacao(agora))} · ${dataHoraCurta(agora)} · ${t('Semana {n}', { n: semanaISO(agora) })}`;

function telaCarregando() {
  app.innerHTML = `<div class="centro-tela"><div class="marca marca-grande"><img class="marca-icone" src="img/icone-192.png" alt="" width="64" height="64">Rostag <span>Systems</span></div><p class="meta">${esc(t('Carregando…'))}</p></div>`;
}

let estadoLogin = { modo: 'entrar', msg: '', convite: undefined, codigo: null };
let cadastrando = false;

function telaLogin() {
  const codigo = codigoConvite();
  if (codigo && estadoLogin.codigo !== codigo) {
    // Primeira vez com este convite: busca os dados para mostrar a equipe.
    estadoLogin = { modo: 'criar', msg: '', convite: null, codigo };
    fonte.lerConvite(codigo)
      .then((c) => { estadoLogin.convite = conviteValido(c) ? c : false; if (!estadoLogin.convite) esquecerConvite(); desenhar(); })
      .catch(() => { estadoLogin.convite = false; esquecerConvite(); desenhar(); });
  }
  const { modo, msg, convite } = estadoLogin;
  let faixa = '';
  if (codigo && convite === null) faixa = `<p class="faixa-convite">${esc(t('Verificando convite…'))}</p>`;
  else if (convite) {
    const nivel = esc(t(NIVEIS[convite.nivel]));
    faixa = `<p class="faixa-convite">${convite.equipeNome
      ? t('Você foi convidado para a equipe de <strong>{equipe}</strong> como <strong>{nivel}</strong>.', { equipe: esc(convite.equipeNome), nivel })
      : t('Você foi convidado como <strong>{nivel}</strong>.', { nivel })} ${esc(t('Crie sua conta abaixo para entrar.'))}</p>`;
  } else if (convite === false) {
    faixa = `<p class="faixa-convite faixa-erro">${esc(t('Este convite não vale mais (expirou, já foi usado ou foi cancelado). Peça um novo à gerência.'))}</p>`;
  }

  app.innerHTML = `
    <div class="centro-tela">
      <div class="marca marca-grande"><img class="marca-icone" src="img/icone-192.png" alt="" width="64" height="64">Rostag <span>Systems</span></div>
      <p class="meta" id="relogio-login">${esc(linhaRelogio(new Date()))}</p>
      ${faixa}
      <form class="cartao form form-login" id="form-login">
        <div class="abas" role="tablist">
          <button type="button" role="tab" class="${modo === 'entrar' ? 'ativo' : ''}" data-modo="entrar">${esc(t('Entrar'))}</button>
          <button type="button" role="tab" class="${modo === 'criar' ? 'ativo' : ''}" data-modo="criar">${esc(t('Criar conta'))}</button>
        </div>
        ${modo === 'criar' ? `<label>${esc(t('Nome'))}<input name="nome" required maxlength="60" autocomplete="name"></label>` : ''}
        <label>${esc(t('E-mail'))}<input name="email" type="email" required autocomplete="email"></label>
        <label>${esc(t('Senha'))}<input name="senha" type="password" required minlength="6" autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}"></label>
        ${msg ? `<p class="texto-alerta">${esc(msg)}</p>` : ''}
        <button class="botao">${esc(t(modo === 'criar' ? 'Criar conta' : 'Entrar'))}</button>
      </form>
    </div>`;
  app.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { estadoLogin.modo = b.dataset.modo; estadoLogin.msg = ''; desenhar(); }));
  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    try {
      if (estadoLogin.modo === 'criar') {
        cadastrando = true;
        try {
          await fonte.cadastrar(d.nome.trim(), d.email.trim(), d.senha, estadoLogin.convite ? estadoLogin.codigo : null);
        } finally { cadastrando = false; esquecerConvite(); }
      } else {
        await fonte.entrar(d.email.trim(), d.senha);
      }
    } catch (e) {
      const msgs = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/wrong-password': 'E-mail ou senha incorretos.',
        'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/email-already-in-use': 'Este e-mail já tem conta. Use “Entrar”.',
        'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres.'
      };
      estadoLogin.msg = t(msgs[e.code] || e.message);
      if (!estado.usuario) desenhar();
    }
  });
}

// Relógio da tela de login também fica sempre atualizado.
setInterval(() => {
  const el = document.getElementById('relogio-login');
  if (el) el.textContent = linhaRelogio(new Date());
}, 1000);

function telaPendente() {
  app.innerHTML = `
    <div class="centro-tela">
      <div class="marca marca-grande"><img class="marca-icone" src="img/icone-192.png" alt="" width="64" height="64">Rostag <span>Systems</span></div>
      <h1>${esc(t('Olá {nome}', { nome: primeiroNome(estado.usuario.nome) }))}</h1>
      <p>${t('Sua conta foi criada e está <strong>aguardando liberação da gerência</strong>.')}</p>
      <p class="meta">${esc(t('Assim que seu nível for definido, esta tela atualiza sozinha.'))}</p>
      <button class="botao-sec" id="sair">${esc(t('Sair'))}</button>
    </div>`;
  $('#sair').addEventListener('click', () => fonte.sair());
}

/* ------------------------------------------------------------------ casca */

let cascaMontada = false;
let rotaMontada = '';

function montarCasca() {
  app.innerHTML = `
    <header class="topo">
      <a class="marca" href="#/inicio"><img class="marca-icone" src="img/icone-64.png" alt="" width="30" height="30">Rostag <span>Systems</span></a>
      <nav class="menu" id="menu" aria-label="Principal"></nav>
      <a class="usuario" id="usuario" href="#/config/conta"></a>
    </header>
    ${MODO_DEMO ? '<div class="faixa-demo" id="faixa-demo"></div>' : ''}
    <main id="conteudo"></main>`;
  cascaMontada = true;
}

function desenharCasca() {
  const u = estado.usuario;
  const r = rotaAtual();
  $('#menu').innerHTML = ROTAS.filter((x) => !x.oculto).map((x) =>
    `<a href="#/${x.id}" class="${r.id === x.id ? 'ativo' : ''}" ${r.id === x.id ? 'aria-current="page"' : ''}>${esc(t(x.nome))}</a>`).join('');
  const usuario = $('#usuario');
  usuario.classList.toggle('ativo', r.id === 'config');
  usuario.title = t('Configurações');
  usuario.innerHTML = `${avatar(u.nome)}<div><strong>${esc(u.nome)}</strong><small>${esc(t(NIVEIS[u.nivel]))}</small></div><span class="engrenagem" aria-hidden="true">⚙</span>`;

  const faixa = $('#faixa-demo');
  if (faixa) {
    faixa.innerHTML = `<span><strong>${esc(t('Modo demonstração'))}</strong> · ${esc(t('dados só neste navegador. Ver como:'))}</span>
      <select id="trocar-usuario" aria-label="${esc(t('Ver como'))}">
        ${estado.usuarios.filter(ativo).map((x) => `<option value="${esc(x.id)}" ${x.id === u.id ? 'selected' : ''}>${esc(x.nome)} — ${esc(t(NIVEIS[x.nivel]))}</option>`).join('')}
      </select>
      <button class="botao-link" id="restaurar-demo">${esc(t('Restaurar exemplo'))}</button>`;
    $('#trocar-usuario').addEventListener('change', (ev) => fonte.trocarUsuario(ev.target.value));
    $('#restaurar-demo').addEventListener('click', () => { if (confirm(t('Apagar as mudanças e voltar aos dados de exemplo?'))) fonte.restaurarDemo(); });
  }
}

function desenharPagina(manterFoco = true) {
  const r = rotaAtual();
  const rota = ROTAS.find((x) => x.id === r.id);
  if (!rota) { location.hash = '#/inicio'; return; }

  // Guarda foco/cursor de um filtro em digitação para não perder ao redesenhar.
  const ativoEl = document.activeElement;
  const filtroFocado = manterFoco && ativoEl && ativoEl.dataset && ativoEl.dataset.filtro;
  const cursor = filtroFocado && ativoEl.selectionStart;
  // Não redesenha a página enquanto a pessoa digita num campo dela (ex.: nome na Conta).
  const conteudo = $('#conteudo');
  if (manterFoco && !filtroFocado && ativoEl && conteudo.contains(ativoEl) && ativoEl.matches('input:not([type=checkbox]), textarea')) return;

  const rolagem = window.scrollY;
  const chave = `${r.id}/${r.param}`;
  if (rotaMontada.startsWith('inicio') && r.id !== 'inicio') desmontarInicio();
  const pagina = document.createElement('div');
  pagina.className = `pagina pagina-${r.id}`;
  pagina.innerHTML = rota.render(r.param);
  conteudo.replaceChildren(pagina);
  if (rota.montar) rota.montar(pagina, r.id === 'config' ? redesenharTudo : (foco) => desenharPagina(foco));

  if (filtroFocado) {
    const el = pagina.querySelector(`[data-filtro="${filtroFocado}"]`);
    if (el) { el.focus(); if (cursor != null && el.setSelectionRange) el.setSelectionRange(cursor, cursor); }
  }
  if (chave === rotaMontada) window.scrollTo(0, rolagem); else window.scrollTo(0, 0);
  rotaMontada = chave;
}

/** Depois de trocar tema ou idioma: redesenha tudo (casca, página, rodapé). */
function redesenharTudo() {
  if (modalAberto()) fecharModal();
  desenharRodape();
  rotaMontada = '';
  if (cascaMontada) { desenharCasca(); desenharPagina(false); } else desenhar();
}

function desenhar() {
  desenharRodape();
  if (!estado.carregado) { telaCarregando(); cascaMontada = false; return; }
  if (!estado.usuario) { cascaMontada = false; desmontarInicio(); telaLogin(); return; }
  if (!cadastrando && codigoConvite() && ativo(estado.usuario)) { esquecerConvite(); aviso(t('Você já tem conta. Saia primeiro para usar um convite.'), 'erro'); }
  if (!ativo(estado.usuario)) { cascaMontada = false; desmontarInicio(); telaPendente(); return; }
  estadoLogin = { modo: 'entrar', msg: '', convite: undefined, codigo: null };
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

window.addEventListener('hashchange', () => {
  guardarConviteDaUrl();
  if (cascaMontada) { desenharCasca(); desenharPagina(false); } else desenhar();
});

guardarConviteDaUrl();
vigiarAtualizacoes();
aoMudar(desenhar);
try { iniciarEstado(); } catch (e) { erro(e); app.innerHTML = `<div class="centro-tela"><p class="texto-alerta">${esc(e.message)}</p></div>`; }
desenhar();
// Os gráficos medem os rótulos com a fonte; redesenha quando a Inter terminar de carregar.
if (document.fonts) document.fonts.ready.then(() => { if (cascaMontada) desenharPagina(false); });
