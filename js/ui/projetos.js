/* Projetos: lista (visível para todos), página do projeto e formulário.
   Cada projeto é um escopo de uma commessa (2025-006 · Motorização), com
   cliente, tipo de serviço, início, entrega, 1 líder e analistas responsáveis. */

import { estado, fonte, nomeDe, pessoaDe } from '../estado.js';
import {
  podeCriarProjeto, ehGerente, atrasada, STATUS, nomeProjeto, commessaValida, arquivado, membrosDaEquipe,
  projetoAberto, naLixeira, SITUACOES, acoesDeSituacao
} from '../dominio/regras.js';
import { fmtData, fmtDataHora } from '../dominio/datas.js';
import { t as T } from '../i18n.js';
import { esc, avatar, abrirModal, fecharModal, aviso, erro, confirmar } from './base.js';
import { notificarProjeto } from '../notificar.js';
import { cartaoTarefa } from './tarefas.js';

export function progresso(tarefas) {
  const total = tarefas.length;
  const feitas = tarefas.filter((t) => t.status === 'concluida').length;
  return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

/** Avatares do líder e analistas responsáveis. */
export function responsaveisHtml(p) {
  const ids = [p.liderId, ...(p.analistaIds || [])].filter(Boolean);
  if (!ids.length) return '';
  return `<span class="responsaveis" title="${esc(ids.map(nomeDe).join(', '))}">${ids.map((id) => avatar(pessoaDe(id), 'avatar-p')).join('')}</span>`;
}

export function periodoTexto(p) {
  if (p.inicio && p.prazo) return `${fmtData(p.inicio)} → ${fmtData(p.prazo)}`;
  if (p.prazo) return T('Entrega {d}', { d: fmtData(p.prazo) });
  return '';
}

const porEntrega = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || nomeProjeto(a).localeCompare(nomeProjeto(b));

export function renderProjetos() {
  const eu = estado.usuario;
  const abertos = estado.projetos.filter(projetoAberto).sort(porEntrega);
  const arquivados = estado.projetos.filter(arquivado).sort((a, b) => (b.prazo || '').localeCompare(a.prazo || ''));
  const lixeira = ehGerente(eu) ? estado.projetos.filter(naLixeira).sort((a, b) => (b.excluidoEm || 0) - (a.excluidoEm || 0)) : [];

  const card = (p) => {
    const tarefas = estado.tarefas.filter((t) => t.projetoId === p.id);
    const pr = progresso(tarefas);
    const atras = tarefas.filter((t) => atrasada(t)).length;
    return `
      <a class="card-projeto sit-proj-${esc(p.status || 'aberto')} ${arquivado(p) ? 'concluido' : ''}" href="#/projetos/${esc(p.id)}">
        <div class="cp-selos">${p.commessa ? `<span class="cp-commessa">${esc(p.commessa)}</span>` : ''}${seloSituacao(p, true)}</div>
        <h3>${esc(p.nome)}</h3>
        ${p.cliente || p.tipoServico ? `<p>${esc([p.cliente, p.tipoServico].filter(Boolean).join(' · '))}</p>` : ''}
        ${periodoTexto(p) ? `<p class="cp-periodo">${esc(periodoTexto(p))}</p>` : ''}
        <div class="barra" aria-label="${esc(T('{p}% concluído', { p: pr.pct }))}"><span style="width:${pr.pct}%"></span></div>
        <div class="cp-rodape">
          ${responsaveisHtml(p)}
          <span>${esc(T(ehGerente(eu) ? '{f}/{t} tarefas' : '{f}/{t} tarefas da equipe', { f: pr.feitas, t: pr.total }))}</span>
          ${atras ? `<span class="prazo atrasada">${esc(T('{n} atrasada(s)', { n: atras }))}</span>` : ''}
        </div>
      </a>`;
  };

  return `
    <header class="titulo-pagina">
      <h1>${esc(T('Projetos'))}</h1>
      <p>${esc(T('{a} em aberto · {c} arquivado(s)', { a: abertos.length, c: arquivados.length }))}</p>
      ${podeCriarProjeto(eu) ? `<button class="botao" data-novo-projeto>${esc(T('+ Novo projeto'))}</button>` : ''}
    </header>
    ${abertos.length ? `<div class="grade-projetos">${abertos.map(card).join('')}</div>` : `<p class="vazio">${esc(T('Nenhum projeto em aberto.'))}</p>`}
    ${arquivados.length ? `<details class="grupo arquivados"><summary><h2>${esc(T('Ver arquivados'))} <span class="contador">${arquivados.length}</span></h2></summary>
      <div class="grade-projetos">${arquivados.map(card).join('')}</div></details>` : ''}
    ${lixeira.length ? `<details class="grupo arquivados lixeira"><summary><h2>🗑 ${esc(T('Lixeira'))} <span class="contador">${lixeira.length}</span></h2></summary>
      <p class="meta-centro">${esc(T('Projetos excluídos não aparecem para ninguém. A gerência pode restaurar ou apagar de vez.'))}</p>
      <div class="grade-projetos">${lixeira.map(card).join('')}</div></details>` : ''}`;
}

/** Selo da situação (Pausado, Finalizado, Cancelado, Na lixeira). Com soDiferente, "Em andamento" não aparece. */
export function seloSituacao(p, soDiferente = false) {
  const st = p.status || 'aberto';
  if (soDiferente && st === 'aberto') return '';
  return `<span class="selo-sit selo-sit-${esc(st)}">${esc(T(SITUACOES[st] || st))}</span>`;
}

const ROTULO_ACAO = {
  pausar: 'Pausar', retomar: 'Retomar', finalizar: 'Finalizar', cancelar: 'Cancelar projeto', reabrir: 'Reabrir',
  excluir: 'Excluir', restaurar: 'Restaurar', apagar: 'Apagar de vez'
};
const PERGUNTA_ACAO = {
  pausar: 'Tem certeza que deseja pausar o projeto “{p}”?',
  retomar: 'Tem certeza que deseja retomar o projeto “{p}”?',
  finalizar: 'Tem certeza que deseja finalizar o projeto “{p}”? Ele vai para os arquivados e as tarefas saem do Quadro.',
  cancelar: 'Tem certeza que deseja cancelar o projeto “{p}”? Ele vai para os arquivados e as tarefas saem do Quadro.',
  reabrir: 'Tem certeza que deseja reabrir o projeto “{p}”?',
  excluir: 'Tem certeza que deseja excluir o projeto “{p}”? Ele vai para a Lixeira e some para todos, junto com as tarefas.',
  restaurar: 'Tem certeza que deseja restaurar o projeto “{p}”?',
  apagar: 'Tem certeza? O projeto “{p}” e as {n} tarefa(s) dele serão apagados de vez. Isso não pode ser desfeito.'
};
const AVISO_ACAO = {
  pausar: 'Projeto pausado', retomar: 'Projeto retomado', finalizar: 'Projeto finalizado', cancelar: 'Projeto cancelado',
  reabrir: 'Projeto reaberto', excluir: 'Projeto enviado para a Lixeira', restaurar: 'Projeto restaurado', apagar: 'Projeto apagado'
};

function botoesSituacao(p) {
  const acoes = acoesDeSituacao(p, estado.usuario);
  if (!acoes.length) return '';
  const classe = (a) => (['excluir', 'apagar', 'cancelar'].includes(a) ? 'botao-perigo-p' : 'botao-sec');
  return `<div class="acoes acoes-situacao">${acoes.map((a) =>
    `<button type="button" class="${classe(a)}" data-situacao="${a}" data-projeto-id="${esc(p.id)}">${esc(T(ROTULO_ACAO[a]))}</button>`).join('')}</div>`;
}

/** Clique num botão de situação: pergunta "Tem certeza?" e aplica. */
export function aplicarSituacao(id, acao) {
  const p = estado.projetos.find((x) => x.id === id);
  if (!p) return;
  const eu = estado.usuario;
  const tarefas = estado.tarefas.filter((t) => t.projetoId === id);
  if (!confirmar(T(PERGUNTA_ACAO[acao], { p: nomeProjeto(p), n: tarefas.length }))) return;
  const feito = acao === 'apagar'
    ? fonte.apagarProjeto(id, tarefas.map((t) => t.id)).then(() => { location.hash = '#/projetos'; })
    : fonte.mudarSituacaoProjeto(id, acao, eu.id).then(() => { if (acao === 'excluir' && !ehGerente(eu)) location.hash = '#/projetos'; });
  feito.then(() => { notificarProjeto(acao, p); aviso(T(AVISO_ACAO[acao])); }).catch(erro);
}

const TEXTO_ACAO_PROJETO = {
  criou: 'criou o projeto', editou: 'editou o projeto', pausar: 'pausou', retomar: 'retomou', finalizar: 'finalizou',
  cancelar: 'cancelou', reabrir: 'reabriu', excluir: 'enviou para a Lixeira', restaurar: 'restaurou'
};

export function renderProjeto(id) {
  const p = estado.projetos.find((x) => x.id === id);
  const eu = estado.usuario;
  if (!p || (naLixeira(p) && !ehGerente(eu))) return `<p class="vazio">${esc(T(p ? 'Este projeto está na Lixeira.' : 'Projeto não encontrado.'))} <a href="#/projetos">${esc(T('Voltar'))}</a></p>`;
  const tarefas = estado.tarefas.filter((t) => t.projetoId === id);
  const pr = progresso(tarefas);
  const ficha = [
    [T('Cliente'), p.cliente],
    [T('Tipo de serviço'), p.tipoServico],
    [T('Data de início'), p.inicio ? fmtData(p.inicio) : ''],
    [T('Data de entrega'), p.prazo ? fmtData(p.prazo) : ''],
    [T('Líder responsável'), p.liderId ? nomeDe(p.liderId) : ''],
    [T('Analistas responsáveis'), (p.analistaIds || []).map(nomeDe).join(', ')]
  ].filter(([, v]) => v);
  return `
    <a class="voltar" href="#/projetos">${esc(T('← Projetos'))}</a>
    <header class="titulo-pagina">
      ${p.commessa ? `<span class="cp-commessa">${esc(p.commessa)}</span>` : ''}
      <h1>${esc(p.nome)}</h1>
      ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
      <p class="meta-centro">
        ${seloSituacao(p)} · ${esc(T('Criado por {nome}', { nome: nomeDe(p.criadoPor) }))}
      </p>
      ${p.status === 'pausado' ? `<p class="faixa-pausado">⏸ ${esc(T('Projeto pausado. As tarefas continuam visíveis, mas o trabalho está parado.'))}</p>` : ''}
      ${ficha.length ? `<dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      <div class="barra barra-larga" aria-label="${esc(T('{p}% concluído', { p: pr.pct }))}"><span style="width:${pr.pct}%"></span></div>
      <p class="meta-centro">${esc(T('{p}% · {f} de {t} tarefas concluídas', { p: pr.pct, f: pr.feitas, t: pr.total }))}${ehGerente(eu) ? '' : esc(T(' (da sua equipe)'))}</p>
      <div class="acoes">
        ${projetoAberto(p) ? `<button class="botao" data-nova-tarefa data-projeto="${esc(p.id)}">${esc(T('+ Nova tarefa'))}</button>` : ''}
        ${podeCriarProjeto(eu) && !naLixeira(p) ? `<button class="botao-sec" data-editar-projeto="${esc(p.id)}">${esc(T('Editar projeto'))}</button>` : ''}
      </div>
      ${botoesSituacao(p)}
    </header>
    <div class="grupos">
      ${STATUS.map((s) => {
        const itens = tarefas.filter((t) => t.status === s.id);
        return itens.length ? `<section class="grupo"><h2>${esc(T(s.nome))} <span class="contador">${itens.length}</span></h2>
          <div class="grade-cards">${itens.map((t) => cartaoTarefa(t)).join('')}</div></section>` : '';
      }).join('') || `<p class="vazio">${esc(T('Nenhuma tarefa visível neste projeto.'))}</p>`}
    </div>
    ${(p.historico || []).length ? `<details class="historico historico-projeto">
      <summary>${esc(T('Histórico ({n})', { n: p.historico.length }))}</summary>
      <ol>${p.historico.slice().sort((a, b) => b.em - a.em).map((h) => `
        <li><time>${esc(fmtDataHora(h.em))}</time> <strong>${esc(nomeDe(h.por))}</strong> ${esc(T(TEXTO_ACAO_PROJETO[h.acao] || h.acao))}</li>`).join('')}</ol>
    </details>` : ''}`;
}

/* ------------------------------------------------------------ formulário */

function checksAnalistas(liderId, marcados) {
  const analistas = membrosDaEquipe(liderId, estado.usuarios).filter((u) => u.nivel === 'analista');
  if (!liderId) return `<p class="meta">${esc(T('Escolha o líder para ver os analistas.'))}</p>`;
  if (!analistas.length) return `<p class="meta">${esc(T('Este líder ainda não tem analistas.'))}</p>`;
  return analistas.map((a) => `
    <label class="check-pessoa"><input type="checkbox" name="analistaIds" value="${esc(a.id)}" ${marcados.includes(a.id) ? 'checked' : ''}>
      ${avatar(a, 'avatar-p')} ${esc(a.nome)}</label>`).join('');
}

export function formProjeto(id = null) {
  const p = id ? estado.projetos.find((x) => x.id === id) : null;
  const eu = estado.usuario;
  const lideres = estado.usuarios.filter((u) => u.nivel === 'lider');
  const liderInicial = p ? p.liderId || '' : (eu.nivel === 'lider' ? eu.id : '');
  const tipos = [...new Set(estado.projetos.map((x) => x.tipoServico).filter(Boolean)
    .concat([T('Fabricação'), T('Manutenção'), T('Serviços gerais')]))];
  const clientes = [...new Set(estado.projetos.map((x) => x.cliente).filter(Boolean))];
  const v = (campo) => esc(p ? p[campo] || '' : '');
  // Líder e analistas ficam guardados aqui para sobreviver ao redesenho ao vivo do modal.
  const sel = { liderId: liderInicial, analistaIds: p ? [...(p.analistaIds || [])] : [] };

  abrirModal({
    largo: true,
    render: () => `
      <form class="form" data-form-projeto novalidate>
        <header class="modal-topo"><h2>${esc(T(p ? 'Editar projeto' : 'Novo projeto'))}</h2><button type="button" class="fechar" data-fechar aria-label="${esc(T('Fechar'))}">×</button></header>
        <div class="form-linha">
          <label>${esc(T('Commessa'))}<input name="commessa" required placeholder="2025-006" pattern="\\d{4}-\\d{3}" maxlength="8" value="${v('commessa')}" autofocus data-guardar="commessa" data-rascunho></label>
          <label class="col-2">${esc(T('Escopo'))}<input name="nome" required maxlength="100" placeholder="${esc(T('Ex.: Motorização, Plataforma TP01'))}" value="${v('nome')}" data-guardar="nome" data-rascunho></label>
        </div>
        <div class="form-linha">
          <label>${esc(T('Cliente'))}<input name="cliente" required maxlength="80" list="lista-clientes" value="${v('cliente')}" data-guardar="cliente" data-rascunho></label>
          <label>${esc(T('Tipo de serviço'))}<input name="tipoServico" required maxlength="60" list="lista-tipos" value="${v('tipoServico')}" data-guardar="tipoServico" data-rascunho></label>
        </div>
        <datalist id="lista-clientes">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <datalist id="lista-tipos">${tipos.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <div class="form-linha">
          <label>${esc(T('Data de início'))}<input type="date" name="inicio" required value="${v('inicio')}" data-guardar="inicio" data-rascunho></label>
          <label>${esc(T('Data de entrega'))}<input type="date" name="prazo" required value="${v('prazo')}" data-guardar="prazo" data-rascunho></label>
        </div>
        <label>${esc(T('Líder responsável'))}<select name="liderId" required data-lider-projeto>
          <option value="">${esc(T('Escolha o líder'))}</option>
          ${lideres.map((l) => `<option value="${esc(l.id)}" ${l.id === sel.liderId ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}
        </select></label>
        <fieldset class="analistas-campo"><legend>${esc(T('Analistas responsáveis'))}</legend>
          <div data-analistas>${checksAnalistas(sel.liderId, sel.analistaIds)}</div>
        </fieldset>
        <label>${esc(T('Descrição'))}<textarea name="descricao" rows="2" data-guardar="descricao" data-rascunho>${v('descricao')}</textarea></label>
        <p class="texto-alerta" data-erro-form hidden></p>
        <footer class="modal-rodape"><button type="button" class="botao-sec" data-fechar>${esc(T('Cancelar'))}</button><button class="botao">${esc(T(p ? 'Salvar' : 'Criar projeto'))}</button></footer>
      </form>`,
    eventos: {
      click: (ev) => { if (ev.target.closest('[data-fechar]')) fecharModal(); },
      change: (ev) => {
        if (ev.target.matches('[data-lider-projeto]')) {
          sel.liderId = ev.target.value; sel.analistaIds = [];
          ev.currentTarget.querySelector('[data-analistas]').innerHTML = checksAnalistas(sel.liderId, []);
        }
        if (ev.target.name === 'analistaIds') {
          sel.analistaIds = [...ev.currentTarget.querySelectorAll('input[name="analistaIds"]:checked')].map((x) => x.value);
        }
      },
      submit: (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const fd = new FormData(f);
        const d = Object.fromEntries(fd);
        const dados = {
          commessa: d.commessa.trim(), nome: d.nome.trim(), cliente: d.cliente.trim(), tipoServico: d.tipoServico.trim(),
          inicio: d.inicio || null, prazo: d.prazo || null, liderId: d.liderId || null,
          analistaIds: fd.getAll('analistaIds'), descricao: d.descricao.trim()
        };
        const falta = !dados.nome || !dados.cliente || !dados.tipoServico || !dados.inicio || !dados.prazo || !dados.liderId;
        const msg = !commessaValida(dados.commessa) ? T('A commessa deve ter o formato AAAA-NNN (ex.: 2025-006).')
          : falta ? T('Preencha todos os campos obrigatórios.')
            : dados.inicio > dados.prazo ? T('A data de entrega não pode ser antes do início.') : '';
        const caixaErro = f.querySelector('[data-erro-form]');
        if (msg) { caixaErro.textContent = msg; caixaErro.hidden = false; return; }
        if (!p) dados.criadoPor = eu.id;
        fonte.salvarProjeto(dados, p ? p.id : null, eu.id)
          .then((id) => {
            notificarProjeto(p ? 'editou' : 'criou', { id, ...(p || {}), ...dados });
            fecharModal(); aviso(T(p ? 'Projeto salvo' : 'Projeto criado'));
          }).catch(erro);
      }
    }
  });
}
