/* Configurações (tela cheia): Conta · Equipe · Sobre. */

import { estado, fonte, nomeDe } from '../estado.js';
import { MODO_DEMO, VERSAO, LINKS } from '../config.js';
import {
  NIVEIS, ehGerente, ehAdm, equipeDe, niveisQuePodeDar, podeEditarPessoa, pessoasVisiveis, conviteValido
} from '../dominio/regras.js';
import { fmtDataHora } from '../dominio/datas.js';
import { t } from '../i18n.js';
import { pref, definirPref } from '../prefs.js';
import { esc, avatar, aviso, erro, copiar, confirmar } from './base.js';
import { reduzirFoto } from './foto.js';

export const ABAS_CONFIG = [
  { id: 'conta', nome: 'Conta' },
  { id: 'equipe', nome: 'Equipe' },
  { id: 'sobre', nome: 'Sobre' }
];

export function linkConvite(codigo) {
  return `${location.origin}${location.pathname}#/convite/${encodeURIComponent(codigo)}`;
}

export function renderConfig(aba) {
  const atual = ABAS_CONFIG.some((a) => a.id === aba) ? aba : 'conta';
  const corpo = { conta: abaConta, equipe: abaEquipe, sobre: abaSobre }[atual]();
  return `
    <header class="titulo-pagina">
      <h1>${esc(t('Configurações'))}</h1>
    </header>
    <nav class="abas-config" aria-label="${esc(t('Configurações'))}">
      ${ABAS_CONFIG.map((a) => `<a href="#/config/${a.id}" class="${a.id === atual ? 'ativo' : ''}" ${a.id === atual ? 'aria-current="page"' : ''}>${esc(t(a.nome))}</a>`).join('')}
    </nav>
    <div class="config-corpo">${corpo}</div>`;
}

/* ------------------------------------------------------------------ conta */

function abaConta() {
  const u = estado.usuario;
  const eq = equipeDe(u);
  const seg = (grupo, valor, rotulo) =>
    `<button type="button" class="seg ${pref(grupo) === valor ? 'ativo seg-andamento' : ''}" data-pref="${grupo}" data-valor="${valor}" aria-pressed="${pref(grupo) === valor}">${rotulo}</button>`;
  return `
    <section class="cartao cartao-config">
      <div class="perfil">
        <label class="foto-perfil" title="${esc(t('Trocar foto'))}">
          ${avatar(u, 'avatar-g')}
          <span class="foto-trocar">${esc(t('Trocar foto'))}</span>
          <input type="file" accept="image/*" data-foto hidden>
        </label>
        ${u.foto ? `<button type="button" class="botao-link" data-remover-foto>${esc(t('Remover foto'))}</button>` : ''}
        <h2>${esc(u.nome)}</h2>
        <p class="meta">${esc(u.email || '')}</p>
        <p><span class="selo-texto">${esc(t(NIVEIS[u.nivel]))}</span>${eq ? ` · ${esc(t('Equipe de {nome}', { nome: nomeDe(eq) }))}` : ''}</p>
      </div>
      <form class="form form-nome" data-form-nome>
        <label>${esc(t('Nome'))}<input name="nome" required maxlength="60" value="${esc(u.nome)}"></label>
        <button class="botao">${esc(t('Salvar nome'))}</button>
      </form>
    </section>
    <section class="cartao cartao-config">
      <h2>${esc(t('Aparência'))}</h2>
      <div class="seg-status">${seg('tema', 'claro', `☀ ${esc(t('Claro'))}`)}${seg('tema', 'escuro', `☾ ${esc(t('Escuro'))}`)}</div>
      <h2>${esc(t('Idioma'))}</h2>
      <div class="seg-status">${seg('idioma', 'pt', 'Português')}${seg('idioma', 'en', 'English')}</div>
      <p class="meta-centro">${esc(t('Tema e idioma valem para este aparelho.'))}</p>
    </section>
    ${MODO_DEMO ? '' : `<div class="acoes"><button class="botao-sec" data-sair>${esc(t('Sair'))}</button></div>`}`;
}

/* ------------------------------------------------------------------ equipe */

function organograma(lideres, analistas) {
  return `
    <div class="organograma">
      ${lideres.map((l) => `
        <div class="org-equipe">
          <div class="org-lider">${avatar(l)}<strong>${esc(l.nome)}</strong><small>${esc(t('Líder'))}</small></div>
          <ul>${analistas.filter((a) => a.liderId === l.id).map((a) => `<li>${avatar(a, 'avatar-p')}${esc(a.nome)}</li>`).join('') || `<li class="meta">${esc(t('Sem analistas'))}</li>`}</ul>
        </div>`).join('') || `<p class="vazio">${esc(t('Defina pelo menos um líder abaixo.'))}</p>`}
    </div>`;
}

function abaEquipe() {
  const eu = estado.usuario;
  const visiveis = pessoasVisiveis(eu, estado.usuarios);
  const lideres = visiveis.filter((u) => u.nivel === 'lider');
  const analistas = visiveis.filter((u) => u.nivel === 'analista');

  // Líder e analista: só veem a própria equipe, sem editar.
  if (!ehGerente(eu)) {
    const eq = equipeDe(eu);
    return `
      <h2 class="subtitulo">${esc(t('Sua equipe'))}</h2>
      ${organograma(lideres.filter((l) => l.id === eq), analistas.filter((a) => a.liderId === eq))}`;
  }

  const gerentes = visiveis.filter((u) => ['adm', 'gerente'].includes(u.nivel));
  const pendentes = visiveis.filter((u) => u.nivel === 'pendente').length;
  const ordem = { pendente: 0, adm: 1, gerente: 2, lider: 3, analista: 4 };
  const pessoas = visiveis.slice().sort((a, b) => (ordem[a.nivel] - ordem[b.nivel]) || a.nome.localeCompare(b.nome));
  const niveisConvite = niveisQuePodeDar(eu).filter((n) => n !== 'pendente');
  const convites = estado.convites.filter((c) => conviteValido(c)).sort((a, b) => b.criadoEm - a.criadoEm);

  const linha = (u) => {
    const editavel = podeEditarPessoa(eu, u);
    const opcoes = niveisQuePodeDar(eu);
    return `
      <tr class="${u.nivel === 'pendente' ? 'linha-pendente' : ''}">
        <td><div class="pessoa">${avatar(u)}<div><strong>${esc(u.nome)}</strong><small>${esc(u.email || '')}</small></div></div></td>
        <td>${editavel ? `
          <select data-nivel="${esc(u.id)}" aria-label="${esc(t('Nível'))}: ${esc(u.nome)}">
            ${opcoes.map((id) => `<option value="${id}" ${id === u.nivel ? 'selected' : ''}>${esc(t(NIVEIS[id]))}</option>`).join('')}
          </select>` : `<span class="selo-texto">${esc(t(NIVEIS[u.nivel]))}</span>`}</td>
        <td>${u.nivel === 'analista' ? (editavel ? `
          <select data-lider="${esc(u.id)}" aria-label="${esc(t('Líder'))}: ${esc(u.nome)}">
            <option value="">${esc(t('Sem líder'))}</option>
            ${lideres.map((l) => `<option value="${esc(l.id)}" ${l.id === u.liderId ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}
          </select>` : esc(nomeDe(u.liderId))) : '<span class="meta">—</span>'}</td>
      </tr>`;
  };

  return `
    <p class="meta-centro">${esc(t('{l} líder(es) · {a} analista(s)', { l: lideres.length, a: analistas.length }))}
      ${pendentes ? ` · <strong class="texto-alerta">${esc(t('{n} aguardando liberação', { n: pendentes }))}</strong>` : ''}</p>

    <section class="cartao cartao-config">
      <h2>${esc(t('Convidar pessoa'))}</h2>
      <form class="form-convite" data-form-convite>
        <select name="nivel" data-convite-nivel aria-label="${esc(t('Nível'))}">
          ${niveisConvite.map((n) => `<option value="${n}" ${n === 'analista' ? 'selected' : ''}>${esc(t(NIVEIS[n]))}</option>`).join('')}
        </select>
        <select name="liderId" data-convite-lider aria-label="${esc(t('Escolha o líder'))}">
          <option value="">${esc(t('Escolha o líder'))}</option>
          ${lideres.map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('')}
        </select>
        <button class="botao">${esc(t('Gerar link de convite'))}</button>
      </form>
      <p class="meta-centro">${esc(t('Cada link serve para uma pessoa e vale 7 dias. Quem abrir cria a conta e já entra na equipe.'))}</p>
      <h3 class="subtitulo-p">${esc(t('Convites ativos'))} <span class="contador">${convites.length}</span></h3>
      ${convites.length ? `<ul class="lista-convites">${convites.map((c) => `
        <li>
          <div><strong>${esc(t('como {nivel}', { nivel: t(NIVEIS[c.nivel]) }))}</strong>${c.equipeNome ? ` ${esc(t('na equipe de {nome}', { nome: c.equipeNome }))}` : ''}
            <small>${esc(t('Vence em {d}', { d: fmtDataHora(c.expiraEm) }))}</small></div>
          <button type="button" class="botao-sec" data-copiar-convite="${esc(c.id)}">${esc(t('Copiar link'))}</button>
          <button type="button" class="botao-icone" data-cancelar-convite="${esc(c.id)}" aria-label="${esc(t('Cancelar convite'))}" title="${esc(t('Cancelar convite'))}">×</button>
        </li>`).join('')}</ul>` : `<p class="vazio">${esc(t('Nenhum convite ativo.'))}</p>`}
    </section>

    ${organograma(lideres, analistas)}
    ${gerentes.length ? `<p class="meta-centro">${esc(t('Gerência'))}: ${gerentes.map((g) => esc(g.nome)).join(', ')}</p>` : ''}

    <div class="tabela-caixa">
      <table class="tabela">
        <thead><tr><th>${esc(t('Pessoa'))}</th><th>${esc(t('Nível'))}</th><th>${esc(t('Líder'))}</th></tr></thead>
        <tbody>${pessoas.map(linha).join('')}</tbody>
      </table>
    </div>
    <p class="meta-centro">${esc(t('Quem cria conta sem convite entra como “Aguardando liberação” e só vê o sistema depois que a gerência definir o nível.'))}</p>`;
}

/* ------------------------------------------------------------------ sobre */

function abaSobre() {
  return `
    <section class="cartao cartao-config sobre">
      <div class="marca marca-grande">Rostag <span>Systems</span></div>
      <p>${esc(t('Rostag Systems é um planner para equipes organizarem projetos e tarefas sem perder nenhuma informação, desenvolvido por Guilherme dos Santos Braz, Técnico de processos de caldeiraria e graduando de Engenharia Mecânica pelo IFMG.'))}</p>
      <div class="acoes">
        <a class="botao" href="${esc(LINKS.portfolio)}" target="_blank" rel="noopener noreferrer">${esc(t('Ver meu portfólio ↗'))}</a>
        <a class="botao-sec" href="${esc(LINKS.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(t('LinkedIn ↗'))}</a>
      </div>
      <p class="meta">${esc(t('Versão {v}', { v: VERSAO }))}</p>
    </section>`;
}

/* ------------------------------------------------------------------ eventos */

export function montarConfig(raiz, redesenharTudo) {
  const eu = estado.usuario;

  // Convite: o líder só faz sentido para analista.
  const nivelSel = raiz.querySelector('[data-convite-nivel]');
  const liderSel = raiz.querySelector('[data-convite-lider]');
  const ajustarLider = () => { if (liderSel) liderSel.hidden = nivelSel.value !== 'analista'; };
  if (nivelSel) { nivelSel.addEventListener('change', ajustarLider); ajustarLider(); }

  raiz.addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-pref]');
    if (p) { definirPref(p.dataset.pref, p.dataset.valor); redesenharTudo(); return; }
    if (ev.target.closest('[data-sair]')) { fonte.sair(); return; }
    if (ev.target.closest('[data-remover-foto]')) {
      fonte.atualizarUsuario(eu.id, { foto: null }).then(() => aviso(t('Foto removida'))).catch(erro);
      return;
    }
    const cop = ev.target.closest('[data-copiar-convite]');
    if (cop) { copiar(linkConvite(cop.dataset.copiarConvite)).then(() => aviso(t('Link copiado'))); return; }
    const can = ev.target.closest('[data-cancelar-convite]');
    if (can && confirmar(`${t('Cancelar convite')}?`)) {
      fonte.cancelarConvite(can.dataset.cancelarConvite).then(() => aviso(t('Convite cancelado'))).catch(erro);
    }
  });

  raiz.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('[data-foto]')) {
      const arquivo = el.files && el.files[0];
      el.value = '';
      if (!arquivo) return;
      reduzirFoto(arquivo)
        .then((foto) => fonte.atualizarUsuario(eu.id, { foto }))
        .then(() => aviso(t('Foto atualizada')))
        .catch(erro);
      return;
    }
    if (el.dataset.nivel) {
      const patch = { nivel: el.value };
      if (el.value !== 'analista') patch.liderId = null;
      fonte.atualizarUsuario(el.dataset.nivel, patch).then(() => aviso(t('Nível atualizado'))).catch(erro);
    }
    if (el.dataset.lider !== undefined) {
      fonte.atualizarUsuario(el.dataset.lider, { liderId: el.value || null }).then(() => aviso(t('Líder atualizado'))).catch(erro);
    }
  });

  raiz.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (form.matches('[data-form-nome]')) {
      const nome = form.nome.value.trim();
      if (nome && nome !== eu.nome) fonte.atualizarUsuario(eu.id, { nome }).then(() => aviso(t('Nome salvo'))).catch(erro);
    }
    if (form.matches('[data-form-convite]')) {
      const nivel = form.nivel.value;
      const liderId = nivel === 'analista' ? form.liderId.value : null;
      if (nivel === 'analista' && !liderId) { form.liderId.focus(); aviso(t('Escolha o líder'), 'erro'); return; }
      if (nivel === 'gerente' && !ehAdm(eu)) return;
      const dados = { nivel, liderId, equipeNome: liderId ? nomeDe(liderId) : null };
      fonte.criarConvite(dados, eu.id)
        .then((codigo) => copiar(linkConvite(codigo)))
        .then((ok) => aviso(t(ok ? 'Convite criado e link copiado' : 'Convite criado')))
        .catch(erro);
    }
  });
}
