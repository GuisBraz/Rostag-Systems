/* Tarefas: cartão, "Minhas tarefas", quadro Kanban, nova tarefa e detalhe. */

import { estado, fonte, nomeDe, projetoDe } from '../estado.js';
import {
  STATUS, PRIORIDADES, nomeStatus, nomePrioridade, atrasada, ehGerente, equipeDe,
  membrosDaEquipe, podeVerTarefa
} from '../dominio/regras.js';
import { fmtData, fmtDataHora, hojeISO } from '../dominio/datas.js';
import { esc, avatar, abrirModal, fecharModal, aviso, erro, confirmar } from './base.js';

/* ------------------------------------------------------------------ cartão */

function prazoHtml(t) {
  if (!t.prazo) return '';
  const classe = atrasada(t) ? 'atrasada' : (t.prazo === hojeISO() && t.status !== 'concluida' ? 'hoje' : '');
  return `<span class="prazo ${classe}" title="Prazo">${atrasada(t) ? '! ' : ''}${esc(fmtData(t.prazo))}</span>`;
}

export function cartaoTarefa(t, { arrastavel = false } = {}) {
  const feitos = (t.checklist || []).filter((c) => c.feito).length;
  const total = (t.checklist || []).length;
  const proj = projetoDe(t.projetoId);
  return `
    <article class="card-tarefa prio-${esc(t.prioridade)} ${t.status === 'concluida' ? 'feita' : ''}"
      data-abrir-tarefa="${esc(t.id)}" ${arrastavel ? `draggable="true" data-arrastar="${esc(t.id)}"` : ''} tabindex="0">
      ${proj ? `<span class="ct-projeto">${esc(proj.nome)}</span>` : ''}
      <h3 class="ct-titulo">${esc(t.titulo)}</h3>
      <div class="ct-rodape">
        ${avatar(nomeDe(t.responsavelId))}
        ${prazoHtml(t)}
        ${total ? `<span class="ct-check" title="Checklist">☑ ${feitos}/${total}</span>` : ''}
        ${(t.comentarios || []).length ? `<span class="ct-com" title="Comentários">💬 ${t.comentarios.length}</span>` : ''}
        ${t.prioridade === 'alta' ? '<span class="ct-prio" title="Prioridade alta">Alta</span>' : ''}
      </div>
    </article>`;
}

/* -------------------------------------------------------- minhas tarefas */

export function renderMinhas() {
  const eu = estado.usuario;
  const minhas = estado.tarefas.filter((t) => t.responsavelId === eu.id);
  const hoje = hojeISO();
  const em7 = hojeISO(new Date(Date.now() + 7 * 86400000));
  const abertas = minhas.filter((t) => t.status !== 'concluida').sort(porPrazo);
  const grupos = [
    { nome: 'Atrasadas', itens: abertas.filter((t) => atrasada(t)), classe: 'grupo-alerta' },
    { nome: 'Hoje', itens: abertas.filter((t) => t.prazo === hoje) },
    { nome: 'Próximos 7 dias', itens: abertas.filter((t) => t.prazo > hoje && t.prazo <= em7) },
    { nome: 'Mais adiante', itens: abertas.filter((t) => t.prazo > em7) },
    { nome: 'Sem prazo', itens: abertas.filter((t) => !t.prazo) }
  ].filter((g) => g.itens.length);
  const feitas = minhas.filter((t) => t.status === 'concluida').sort((a, b) => (b.concluidaEm || 0) - (a.concluidaEm || 0));

  return `
    <header class="titulo-pagina">
      <h1>Minhas tarefas</h1>
      <p>${abertas.length} em aberto · ${feitas.length} concluída${feitas.length === 1 ? '' : 's'}</p>
      ${ehGerente(eu) ? '' : '<button class="botao" data-nova-tarefa>+ Nova tarefa</button>'}
    </header>
    ${ehGerente(eu) && !minhas.length ? '<p class="vazio">A gerência acompanha todas as equipes pelo <a href="#/quadro">Quadro</a> e pelos <a href="#/projetos">Projetos</a>.</p>' : ''}
    ${!ehGerente(eu) && !minhas.length ? '<p class="vazio">Nenhuma tarefa com você por enquanto.</p>' : ''}
    <div class="grupos">
      ${grupos.map((g) => `
        <section class="grupo ${g.classe || ''}">
          <h2>${esc(g.nome)} <span class="contador">${g.itens.length}</span></h2>
          <div class="grade-cards">${g.itens.map((t) => cartaoTarefa(t)).join('')}</div>
        </section>`).join('')}
      ${feitas.length ? `
        <details class="grupo">
          <summary><h2>Concluídas <span class="contador">${feitas.length}</span></h2></summary>
          <div class="grade-cards">${feitas.slice(0, 30).map((t) => cartaoTarefa(t)).join('')}</div>
        </details>` : ''}
    </div>`;
}

const porPrazo = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999');

/* ------------------------------------------------------------------ quadro */

export const filtros = { projeto: '', responsavel: '', equipe: '', busca: '' };

function filtrar(tarefas) {
  const b = filtros.busca.trim().toLowerCase();
  return tarefas.filter((t) =>
    (!filtros.projeto || t.projetoId === filtros.projeto) &&
    (!filtros.responsavel || t.responsavelId === filtros.responsavel) &&
    (!filtros.equipe || t.equipeId === filtros.equipe) &&
    (!b || t.titulo.toLowerCase().includes(b) || (t.descricao || '').toLowerCase().includes(b)));
}

export function renderQuadro() {
  const eu = estado.usuario;
  const lideres = estado.usuarios.filter((u) => u.nivel === 'lider');
  const pessoas = ehGerente(eu)
    ? estado.usuarios.filter((u) => u.nivel === 'lider' || u.nivel === 'analista')
    : membrosDaEquipe(equipeDe(eu), estado.usuarios);
  const lista = filtrar(estado.tarefas);
  const opt = (v, txt, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;

  return `
    <header class="titulo-pagina">
      <h1>Quadro</h1>
      <p>${ehGerente(eu) ? 'Todas as equipes' : `Equipe de ${esc(nomeDe(equipeDe(eu)))}`} · arraste os cartões para mudar o status</p>
      <button class="botao" data-nova-tarefa>+ Nova tarefa</button>
    </header>
    <div class="filtros" role="search">
      <input type="search" placeholder="Buscar tarefa…" value="${esc(filtros.busca)}" data-filtro="busca" aria-label="Buscar">
      <select data-filtro="projeto" aria-label="Projeto">${opt('', 'Todos os projetos', filtros.projeto)}${estado.projetos.map((p) => opt(p.id, p.nome, filtros.projeto)).join('')}</select>
      <select data-filtro="responsavel" aria-label="Responsável">${opt('', 'Todos os responsáveis', filtros.responsavel)}${pessoas.map((u) => opt(u.id, u.nome, filtros.responsavel)).join('')}</select>
      ${ehGerente(eu) ? `<select data-filtro="equipe" aria-label="Equipe">${opt('', 'Todas as equipes', filtros.equipe)}${lideres.map((l) => opt(l.id, `Equipe ${l.nome}`, filtros.equipe)).join('')}</select>` : ''}
      ${Object.values(filtros).some(Boolean) ? '<button class="botao-link" data-limpar-filtros>Limpar</button>' : ''}
    </div>
    <div class="kanban">
      ${STATUS.map((s) => {
        const itens = lista.filter((t) => t.status === s.id).sort(porPrazo);
        return `
          <section class="coluna coluna-${s.id}" data-coluna="${s.id}">
            <h2><span class="bolinha" aria-hidden="true"></span>${esc(s.nome)} <span class="contador">${itens.length}</span></h2>
            <div class="coluna-cards">${itens.map((t) => cartaoTarefa(t, { arrastavel: true })).join('') || '<p class="vazio-coluna">Nada aqui</p>'}</div>
          </section>`;
      }).join('')}
    </div>`;
}

export function montarQuadro(raiz, redesenhar) {
  raiz.querySelectorAll('[data-filtro]').forEach((el) => {
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      filtros[el.dataset.filtro] = el.value;
      redesenhar(el.dataset.filtro === 'busca');
    });
  });
  const limpar = raiz.querySelector('[data-limpar-filtros]');
  if (limpar) limpar.addEventListener('click', () => { Object.keys(filtros).forEach((k) => { filtros[k] = ''; }); redesenhar(); });

  // Arrastar e soltar entre colunas.
  raiz.querySelectorAll('[data-arrastar]').forEach((card) => {
    card.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', card.dataset.arrastar); card.classList.add('arrastando'); });
    card.addEventListener('dragend', () => card.classList.remove('arrastando'));
  });
  raiz.querySelectorAll('[data-coluna]').forEach((col) => {
    col.addEventListener('dragover', (ev) => { ev.preventDefault(); col.classList.add('alvo'); });
    col.addEventListener('dragleave', (ev) => { if (!col.contains(ev.relatedTarget)) col.classList.remove('alvo'); });
    col.addEventListener('drop', (ev) => {
      ev.preventDefault(); col.classList.remove('alvo');
      const t = estado.tarefas.find((x) => x.id === ev.dataTransfer.getData('text/plain'));
      if (t && t.status !== col.dataset.coluna) mudarStatus(t, col.dataset.coluna);
    });
  });
}

export function mudarStatus(t, status) {
  const patch = { status, concluidaEm: status === 'concluida' ? Date.now() : null };
  fonte.atualizarTarefa(t.id, patch, estado.usuario.id, [`mudou o status para “${nomeStatus(status)}”`])
    .then(() => { if (status === 'concluida') aviso('Tarefa concluída ✔'); })
    .catch(erro);
}

/* ------------------------------------------------------------ nova tarefa */

function equipesQuePodeUsar() {
  const eu = estado.usuario;
  if (ehGerente(eu)) return estado.usuarios.filter((u) => u.nivel === 'lider').map((l) => ({ id: l.id, nome: `Equipe ${l.nome}` }));
  const eq = equipeDe(eu);
  return eq ? [{ id: eq, nome: `Equipe ${nomeDe(eq)}` }] : [];
}

function opcoesResponsavel(equipeId, selecionado) {
  return membrosDaEquipe(equipeId, estado.usuarios)
    .map((u) => `<option value="${esc(u.id)}" ${u.id === selecionado ? 'selected' : ''}>${esc(u.nome)}</option>`).join('');
}

export function novaTarefa({ projetoId = '' } = {}) {
  const equipes = equipesQuePodeUsar();
  if (!equipes.length) { aviso('Ainda não há equipes. Cadastre um líder em Equipe.', 'erro'); return; }
  const eu = estado.usuario;
  const form = { equipeId: equipes[0].id, responsavelId: ehGerente(eu) ? '' : eu.id };
  const projAbertos = estado.projetos.filter((p) => p.status !== 'concluido');

  abrirModal({
    render: () => `
      <form class="form" data-form-tarefa>
        <header class="modal-topo"><h2>Nova tarefa</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></header>
        <label>Título<input name="titulo" required maxlength="140" autofocus data-guardar="titulo" data-rascunho></label>
        <div class="form-linha">
          <label>Projeto<select name="projetoId" data-guardar="projetoId" data-rascunho>
            <option value="">Sem projeto</option>
            ${projAbertos.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select></label>
          ${equipes.length > 1 ? `<label>Equipe<select name="equipeId" data-equipe>
            ${equipes.map((e) => `<option value="${esc(e.id)}" ${e.id === form.equipeId ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
          </select></label>` : `<input type="hidden" name="equipeId" value="${esc(form.equipeId)}">`}
        </div>
        <div class="form-linha">
          <label>Responsável<select name="responsavelId" required data-responsavel>
            <option value="">Escolha…</option>${opcoesResponsavel(form.equipeId, form.responsavelId)}
          </select></label>
          <label>Prazo<input type="date" name="prazo" data-guardar="prazo" data-rascunho></label>
          <label>Prioridade<select name="prioridade" data-guardar="prioridade" data-rascunho>
            ${PRIORIDADES.map((p) => `<option value="${p.id}" ${p.id === 'media' ? 'selected' : ''}>${p.nome}</option>`).join('')}
          </select></label>
        </div>
        <label>Descrição<textarea name="descricao" rows="4" data-guardar="descricao" data-rascunho placeholder="Detalhes, links, combinados…"></textarea></label>
        <footer class="modal-rodape"><button type="button" class="botao-sec" data-fechar>Cancelar</button><button class="botao">Criar tarefa</button></footer>
      </form>`,
    eventos: {
      click: (ev) => { if (ev.target.closest('[data-fechar]')) fecharModal(); },
      change: (ev) => {
        if (ev.target.matches('[data-equipe]')) {
          form.equipeId = ev.target.value; form.responsavelId = '';
          ev.currentTarget.querySelector('[data-responsavel]').innerHTML = `<option value="">Escolha…</option>${opcoesResponsavel(form.equipeId, '')}`;
        }
        if (ev.target.matches('[data-responsavel]')) form.responsavelId = ev.target.value;
      },
      submit: (ev) => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target));
        const dados = {
          titulo: d.titulo.trim(), projetoId: d.projetoId || null, equipeId: d.equipeId,
          responsavelId: d.responsavelId, prazo: d.prazo || null, prioridade: d.prioridade,
          descricao: d.descricao.trim(), status: 'afazer'
        };
        if (!dados.titulo || !dados.responsavelId) return;
        fonte.criarTarefa(dados, eu.id).then(() => { fecharModal(); aviso('Tarefa criada'); }).catch(erro);
      }
    }
  });
}

/* ---------------------------------------------------------------- detalhe */

export function abrirTarefa(id) {
  const eu = () => estado.usuario;
  const tarefa = () => estado.tarefas.find((t) => t.id === id);

  const salvar = (patch, evento) => {
    const t = tarefa();
    if (!t) return;
    fonte.atualizarTarefa(t.id, patch, eu().id, evento ? [evento] : []).catch(erro);
  };

  abrirModal({
    largo: true,
    render: () => {
      const t = tarefa();
      if (!t || !podeVerTarefa(eu(), t)) return null;
      const ger = ehGerente(eu());
      const proj = projetoDe(t.projetoId);
      const check = t.checklist || [];
      const feitos = check.filter((c) => c.feito).length;
      return `
        <header class="modal-topo detalhe-topo">
          <input class="detalhe-titulo" value="${esc(t.titulo)}" data-campo="titulo" data-guardar="titulo" maxlength="140" aria-label="Título">
          <button type="button" class="fechar" data-fechar aria-label="Fechar">×</button>
        </header>
        <div class="seg-status" role="group" aria-label="Status">
          ${STATUS.map((s) => `<button type="button" class="seg seg-${s.id} ${t.status === s.id ? 'ativo' : ''}" data-status="${s.id}" aria-pressed="${t.status === s.id}">${s.nome}</button>`).join('')}
          ${atrasada(t) ? '<span class="selo-texto atrasada">! Atrasada</span>' : ''}
        </div>
        <div class="detalhe-grade">
          <div class="detalhe-principal">
            <section>
              <h3>Descrição</h3>
              <textarea rows="4" data-campo="descricao" data-guardar="descricao" placeholder="Adicione detalhes, links, combinados…">${esc(t.descricao || '')}</textarea>
            </section>
            <section>
              <h3>Checklist ${check.length ? `<span class="contador">${feitos}/${check.length}</span>` : ''}</h3>
              ${check.length ? `<div class="barra" aria-hidden="true"><span style="width:${Math.round((feitos / check.length) * 100)}%"></span></div>` : ''}
              <ul class="checklist">
                ${check.map((c, i) => `
                  <li class="${c.feito ? 'feito' : ''}">
                    <label><input type="checkbox" data-check="${i}" ${c.feito ? 'checked' : ''}> <span>${esc(c.texto)}</span></label>
                    <button type="button" class="botao-icone" data-check-remover="${i}" aria-label="Remover item">×</button>
                  </li>`).join('')}
              </ul>
              <form class="add-linha" data-check-novo>
                <input placeholder="Adicionar item…" maxlength="200" data-guardar="novoItem" data-rascunho>
                <button class="botao-sec">Adicionar</button>
              </form>
            </section>
            <section>
              <h3>Comentários <span class="contador">${(t.comentarios || []).length}</span></h3>
              <ul class="comentarios">
                ${(t.comentarios || []).slice().sort((a, b) => a.em - b.em).map((c) => `
                  <li>${avatar(nomeDe(c.por))}<div><strong>${esc(nomeDe(c.por))}</strong> <time>${esc(fmtDataHora(c.em))}</time><p>${esc(c.texto)}</p></div></li>`).join('') || '<li class="vazio">Nenhum comentário ainda.</li>'}
              </ul>
              <form class="add-comentario" data-comentar>
                <textarea rows="2" placeholder="Escreva um comentário…" data-guardar="comentario" data-rascunho></textarea>
                <button class="botao">Comentar</button>
              </form>
            </section>
          </div>
          <aside class="detalhe-lateral">
            <label>Responsável<select data-campo="responsavelId">
              ${opcoesResponsavel(t.equipeId, t.responsavelId)}
            </select></label>
            <label>Prazo<input type="date" value="${esc(t.prazo || '')}" data-campo="prazo"></label>
            <label>Prioridade<select data-campo="prioridade">
              ${PRIORIDADES.map((p) => `<option value="${p.id}" ${p.id === t.prioridade ? 'selected' : ''}>${p.nome}</option>`).join('')}
            </select></label>
            <label>Projeto<select data-campo="projetoId">
              <option value="">Sem projeto</option>
              ${estado.projetos.filter((p) => p.status !== 'concluido' || p.id === t.projetoId).map((p) => `<option value="${esc(p.id)}" ${p.id === t.projetoId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
            </select></label>
            <p class="meta">Equipe de <strong>${esc(nomeDe(t.equipeId))}</strong></p>
            <p class="meta">Criada por <strong>${esc(nomeDe(t.criadoPor))}</strong><br>${esc(fmtDataHora(t.criadoEm))}</p>
            ${proj ? `<p class="meta"><a href="#/projetos/${esc(proj.id)}" data-fechar>Ver projeto →</a></p>` : ''}
            <details class="historico">
              <summary>Histórico (${(t.historico || []).length})</summary>
              <ol>${(t.historico || []).slice().sort((a, b) => b.em - a.em).map((h) => `
                <li><time>${esc(fmtDataHora(h.em))}</time> <strong>${esc(nomeDe(h.por))}</strong> ${esc(h.texto)}</li>`).join('')}</ol>
            </details>
            ${ger || eu().nivel === 'lider' ? '<button type="button" class="botao-perigo" data-excluir>Excluir tarefa</button>' : ''}
          </aside>
        </div>`;
    },
    eventos: {
      click: (ev) => {
        const t = tarefa();
        if (!t) return;
        if (ev.target.closest('[data-fechar]')) { fecharModal(); return; }
        const st = ev.target.closest('[data-status]');
        if (st && st.dataset.status !== t.status) { mudarStatus(t, st.dataset.status); return; }
        const rem = ev.target.closest('[data-check-remover]');
        if (rem) {
          const i = Number(rem.dataset.checkRemover);
          const item = t.checklist[i];
          salvar({ checklist: t.checklist.filter((_, j) => j !== i) }, `removeu o item “${item.texto}” do checklist`);
          return;
        }
        if (ev.target.closest('[data-excluir]') && confirmar(`Excluir a tarefa “${t.titulo}”? Isso não pode ser desfeito.`)) {
          fonte.excluirTarefa(t.id).then(() => { fecharModal(); aviso('Tarefa excluída'); }).catch(erro);
        }
      },
      change: (ev) => {
        const t = tarefa();
        if (!t) return;
        if (ev.target.matches('[data-check]')) {
          const i = Number(ev.target.dataset.check);
          const checklist = t.checklist.map((c, j) => (j === i ? { ...c, feito: ev.target.checked } : c));
          salvar({ checklist }, `${ev.target.checked ? 'marcou' : 'desmarcou'} “${t.checklist[i].texto}”`);
          return;
        }
        const campo = ev.target.dataset.campo;
        if (!campo) return;
        let valor = ev.target.value;
        if (campo === 'titulo') { valor = valor.trim(); if (!valor) { ev.target.value = t.titulo; return; } }
        if (campo === 'descricao') valor = valor.trim();
        if ((campo === 'prazo' || campo === 'projetoId') && !valor) valor = null;
        if ((t[campo] ?? null) === valor) return;
        const texto = {
          titulo: `renomeou para “${valor}”`,
          descricao: 'editou a descrição',
          responsavelId: `passou a tarefa para ${nomeDe(valor)}`,
          prazo: valor ? `mudou o prazo para ${fmtData(valor)}` : 'removeu o prazo',
          prioridade: `mudou a prioridade para ${nomePrioridade(valor)}`,
          projetoId: valor ? `moveu para o projeto “${(projetoDe(valor) || {}).nome}”` : 'tirou a tarefa do projeto'
        }[campo];
        salvar({ [campo]: valor }, texto);
      },
      submit: (ev) => {
        ev.preventDefault();
        const t = tarefa();
        if (!t) return;
        if (ev.target.matches('[data-check-novo]')) {
          const inp = ev.target.querySelector('input');
          const texto = inp.value.trim();
          if (!texto) return;
          inp.value = '';
          salvar({ checklist: [...(t.checklist || []), { texto, feito: false }] }, `adicionou “${texto}” ao checklist`);
        }
        if (ev.target.matches('[data-comentar]')) {
          const ta = ev.target.querySelector('textarea');
          const texto = ta.value.trim();
          if (!texto) return;
          ta.value = '';
          fonte.comentar(t.id, texto, eu().id).catch(erro);
        }
      },
      keydown: (ev) => {
        // Ctrl+Enter envia o comentário.
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.closest('[data-comentar]')) {
          ev.target.closest('form').requestSubmit();
        }
      }
    }
  });
}
