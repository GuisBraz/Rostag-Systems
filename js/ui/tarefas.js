/* Tarefas: cartão, "Minhas tarefas", quadro Kanban, nova tarefa e detalhe. */

import { estado, fonte, nomeDe, projetoDe, pessoaDe } from '../estado.js';
import {
  STATUS, PRIORIDADES, nomeStatus, nomePrioridade, atrasada, ehGerente, equipeDe,
  membrosDaEquipe, podeVerTarefa, nomeProjeto, tarefasAtivas, projetoAberto
} from '../dominio/regras.js';
import { fmtData, fmtDataHora, hojeISO, anoCompleto } from '../dominio/datas.js';
import { t as T } from '../i18n.js';
import { esc, avatar, abrirModal, fecharModal, aviso, erro, confirmar } from './base.js';
import { notificarTarefaNova, notificarAtribuida, notificarComentario } from '../notificar.js';

/* ------------------------------------------------------------------ histórico */

/** Texto de um evento do histórico, no idioma atual. Eventos antigos guardavam `texto` pronto. */
export function textoHistorico(h) {
  const v = h.valor;
  switch (h.acao) {
    case 'criou': return T('criou a tarefa');
    case 'status': return T('mudou o status para “{v}”', { v: T(nomeStatus(v)) });
    case 'titulo': return T('renomeou para “{v}”', { v });
    case 'descricao': return T('editou a descrição');
    case 'responsavel': return T('passou a tarefa para {v}', { v: nomeDe(v) });
    case 'prazo': return v ? T('mudou o prazo para {v}', { v: fmtData(v) }) : T('removeu o prazo');
    case 'prioridade': return T('mudou a prioridade para {v}', { v: T(nomePrioridade(v)) });
    case 'projeto': return v ? T('moveu para o projeto “{v}”', { v: nomeProjeto(projetoDe(v)) || '—' }) : T('tirou a tarefa do projeto');
    case 'check_add': return T('adicionou “{v}” ao checklist', { v });
    case 'check_rem': return T('removeu o item “{v}” do checklist', { v });
    case 'check_on': return T('marcou “{v}”', { v });
    case 'check_off': return T('desmarcou “{v}”', { v });
    default: return T(h.texto || '');
  }
}

/* ------------------------------------------------------------------ cartão */

function prazoHtml(t) {
  if (!t.prazo) return '';
  const classe = atrasada(t) ? 'atrasada' : (t.prazo === hojeISO() && t.status !== 'concluida' ? 'hoje' : '');
  return `<span class="prazo ${classe}" title="${esc(T('Prazo'))}">${atrasada(t) ? '! ' : ''}${esc(fmtData(t.prazo))}</span>`;
}

export function cartaoTarefa(t, { arrastavel = false } = {}) {
  const feitos = (t.checklist || []).filter((c) => c.feito).length;
  const total = (t.checklist || []).length;
  const proj = projetoDe(t.projetoId);
  return `
    <article class="card-tarefa prio-${esc(t.prioridade)} ${t.status === 'concluida' ? 'feita' : ''}"
      data-abrir-tarefa="${esc(t.id)}" ${arrastavel ? `draggable="true" data-arrastar="${esc(t.id)}"` : ''} tabindex="0">
      ${proj ? `<span class="ct-projeto">${esc(nomeProjeto(proj))}</span>` : ''}
      <h3 class="ct-titulo">${esc(t.titulo)}</h3>
      <div class="ct-rodape">
        ${avatar(pessoaDe(t.responsavelId))}
        ${prazoHtml(t)}
        ${total ? `<span class="ct-check" title="${esc(T('Checklist'))}">☑ ${feitos}/${total}</span>` : ''}
        ${(t.comentarios || []).length ? `<span class="ct-com" title="${esc(T('Comentários'))}">💬 ${t.comentarios.length}</span>` : ''}
        ${t.prioridade === 'alta' ? `<span class="ct-prio" title="${esc(T('Prioridade alta'))}">${esc(T('Alta'))}</span>` : ''}
      </div>
    </article>`;
}

/* -------------------------------------------------------- minhas tarefas */

export function renderMinhas() {
  const eu = estado.usuario;
  const minhas = tarefasAtivas(estado.tarefas, estado.projetos).filter((t) => t.responsavelId === eu.id);
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
      <h1>${esc(T('Minhas tarefas'))}</h1>
      <p>${esc(T('{a} em aberto · {c} concluída(s)', { a: abertas.length, c: feitas.length }))}</p>
      ${ehGerente(eu) ? '' : `<button class="botao" data-nova-tarefa>${esc(T('+ Nova tarefa'))}</button>`}
    </header>
    ${ehGerente(eu) && !minhas.length ? `<p class="vazio">${T('A gerência acompanha todas as equipes pelo <a href="#/quadro">Quadro</a> e pelos <a href="#/projetos">Projetos</a>.')}</p>` : ''}
    ${!ehGerente(eu) && !minhas.length ? `<p class="vazio">${esc(T('Nenhuma tarefa com você por enquanto.'))}</p>` : ''}
    <div class="grupos">
      ${grupos.map((g) => `
        <section class="grupo ${g.classe || ''}">
          <h2>${esc(T(g.nome))} <span class="contador">${g.itens.length}</span></h2>
          <div class="grade-cards">${g.itens.map((t) => cartaoTarefa(t)).join('')}</div>
        </section>`).join('')}
      ${feitas.length ? `
        <details class="grupo">
          <summary><h2>${esc(T('Concluídas'))} <span class="contador">${feitas.length}</span></h2></summary>
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
  const lista = filtrar(tarefasAtivas(estado.tarefas, estado.projetos));
  const opt = (v, txt, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;
  const alcance = ehGerente(eu) ? T('Todas as equipes') : T('Equipe de {nome}', { nome: nomeDe(equipeDe(eu)) });

  return `
    <header class="titulo-pagina">
      <h1>${esc(T('Quadro'))}</h1>
      <p>${esc(alcance)} · ${esc(T('arraste os cartões para mudar o status'))}</p>
      <button class="botao" data-nova-tarefa>${esc(T('+ Nova tarefa'))}</button>
    </header>
    <div class="filtros" role="search">
      <input type="search" placeholder="${esc(T('Buscar tarefa…'))}" value="${esc(filtros.busca)}" data-filtro="busca" aria-label="${esc(T('Buscar'))}">
      <select data-filtro="projeto" aria-label="${esc(T('Projeto'))}">${opt('', T('Todos os projetos'), filtros.projeto)}${estado.projetos.filter(projetoAberto).map((p) => opt(p.id, nomeProjeto(p), filtros.projeto)).join('')}</select>
      <select data-filtro="responsavel" aria-label="${esc(T('Responsável'))}">${opt('', T('Todos os responsáveis'), filtros.responsavel)}${pessoas.map((u) => opt(u.id, u.nome, filtros.responsavel)).join('')}</select>
      ${ehGerente(eu) ? `<select data-filtro="equipe" aria-label="${esc(T('Equipe'))}">${opt('', T('Todas as equipes'), filtros.equipe)}${lideres.map((l) => opt(l.id, T('Equipe {nome}', { nome: l.nome }), filtros.equipe)).join('')}</select>` : ''}
      ${Object.values(filtros).some(Boolean) ? `<button class="botao-link" data-limpar-filtros>${esc(T('Limpar'))}</button>` : ''}
    </div>
    <div class="kanban">
      ${STATUS.map((s) => {
        const itens = lista.filter((t) => t.status === s.id).sort(porPrazo);
        return `
          <section class="coluna coluna-${s.id}" data-coluna="${s.id}">
            <h2><span class="bolinha" aria-hidden="true"></span>${esc(T(s.nome))} <span class="contador">${itens.length}</span></h2>
            <div class="coluna-cards">${itens.map((t) => cartaoTarefa(t, { arrastavel: true })).join('') || `<p class="vazio-coluna">${esc(T('Nada aqui'))}</p>`}</div>
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
  fonte.atualizarTarefa(t.id, patch, estado.usuario.id, [{ acao: 'status', valor: status }])
    .then(() => { if (status === 'concluida') aviso(T('Tarefa concluída ✔')); })
    .catch(erro);
}

/* ------------------------------------------------------------ nova tarefa */

function equipesQuePodeUsar() {
  const eu = estado.usuario;
  if (ehGerente(eu)) return estado.usuarios.filter((u) => u.nivel === 'lider').map((l) => ({ id: l.id, nome: T('Equipe {nome}', { nome: l.nome }) }));
  const eq = equipeDe(eu);
  return eq ? [{ id: eq, nome: T('Equipe {nome}', { nome: nomeDe(eq) }) }] : [];
}

function opcoesResponsavel(equipeId, selecionado) {
  return membrosDaEquipe(equipeId, estado.usuarios)
    .map((u) => `<option value="${esc(u.id)}" ${u.id === selecionado ? 'selected' : ''}>${esc(u.nome)}</option>`).join('');
}

export function novaTarefa({ projetoId = '' } = {}) {
  const equipes = equipesQuePodeUsar();
  if (!equipes.length) { aviso(T('Ainda não há equipes. Cadastre um líder em Equipe.'), 'erro'); return; }
  const eu = estado.usuario;
  const projAbertos = estado.projetos.filter(projetoAberto);
  const equipeDoProjeto = (pid) => {
    const p = projAbertos.find((x) => x.id === pid);
    return p && equipes.some((e) => e.id === p.liderId) ? p.liderId : null;
  };
  const form = { equipeId: equipeDoProjeto(projetoId) || equipes[0].id, responsavelId: ehGerente(eu) ? '' : eu.id };

  abrirModal({
    render: () => `
      <form class="form" data-form-tarefa>
        <header class="modal-topo"><h2>${esc(T('Nova tarefa'))}</h2><button type="button" class="fechar" data-fechar aria-label="${esc(T('Fechar'))}">×</button></header>
        <label>${esc(T('Título'))}<input name="titulo" required maxlength="140" autofocus data-guardar="titulo" data-rascunho></label>
        <div class="form-linha">
          <label>${esc(T('Projeto'))}<select name="projetoId" data-projeto-form data-guardar="projetoId" data-rascunho>
            <option value="">${esc(T('Sem projeto'))}</option>
            ${projAbertos.map((p) => `<option value="${esc(p.id)}" ${p.id === projetoId ? 'selected' : ''}>${esc(nomeProjeto(p))}</option>`).join('')}
          </select></label>
          ${equipes.length > 1 ? `<label>${esc(T('Equipe'))}<select name="equipeId" data-equipe>
            ${equipes.map((e) => `<option value="${esc(e.id)}" ${e.id === form.equipeId ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
          </select></label>` : `<input type="hidden" name="equipeId" value="${esc(form.equipeId)}">`}
        </div>
        <div class="form-linha">
          <label>${esc(T('Responsável'))}<select name="responsavelId" required data-responsavel>
            <option value="">${esc(T('Escolha…'))}</option>${opcoesResponsavel(form.equipeId, form.responsavelId)}
          </select></label>
          <label>${esc(T('Prazo'))}<input type="date" name="prazo" data-guardar="prazo" data-rascunho></label>
          <label>${esc(T('Prioridade'))}<select name="prioridade" data-guardar="prioridade" data-rascunho>
            ${PRIORIDADES.map((p) => `<option value="${p.id}" ${p.id === 'media' ? 'selected' : ''}>${esc(T(p.nome))}</option>`).join('')}
          </select></label>
        </div>
        <label>${esc(T('Descrição'))}<textarea name="descricao" rows="4" data-guardar="descricao" data-rascunho placeholder="${esc(T('Detalhes, links, combinados…'))}"></textarea></label>
        <footer class="modal-rodape"><button type="button" class="botao-sec" data-fechar>${esc(T('Cancelar'))}</button><button class="botao">${esc(T('Criar tarefa'))}</button></footer>
      </form>`,
    eventos: {
      click: (ev) => { if (ev.target.closest('[data-fechar]')) fecharModal(); },
      change: (ev) => {
        if (ev.target.matches('[data-equipe]')) {
          form.equipeId = ev.target.value; form.responsavelId = '';
          ev.currentTarget.querySelector('[data-responsavel]').innerHTML = `<option value="">${esc(T('Escolha…'))}</option>${opcoesResponsavel(form.equipeId, '')}`;
        }
        if (ev.target.matches('[data-responsavel]')) form.responsavelId = ev.target.value;
        if (ev.target.matches('[data-projeto-form]')) {
          // Projeto com líder responsável: a tarefa vai para a equipe dele.
          const eq = equipeDoProjeto(ev.target.value);
          const selEq = ev.currentTarget.querySelector('[data-equipe]');
          if (eq && selEq && eq !== form.equipeId) {
            selEq.value = eq; form.equipeId = eq; form.responsavelId = '';
            ev.currentTarget.querySelector('[data-responsavel]').innerHTML = `<option value="">${esc(T('Escolha…'))}</option>${opcoesResponsavel(eq, '')}`;
          }
        }
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
        fonte.criarTarefa(dados, eu.id).then((id) => {
          notificarTarefaNova({ id, ...dados });
          fecharModal(); aviso(T('Tarefa criada'));
        }).catch(erro);
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
          <input class="detalhe-titulo" value="${esc(t.titulo)}" data-campo="titulo" data-guardar="titulo" maxlength="140" aria-label="${esc(T('Título'))}">
          <button type="button" class="fechar" data-fechar aria-label="${esc(T('Fechar'))}">×</button>
        </header>
        <div class="seg-status" role="group" aria-label="${esc(T('Status'))}">
          ${STATUS.map((s) => `<button type="button" class="seg seg-${s.id} ${t.status === s.id ? 'ativo' : ''}" data-status="${s.id}" aria-pressed="${t.status === s.id}">${esc(T(s.nome))}</button>`).join('')}
          ${atrasada(t) ? `<span class="selo-texto atrasada">${esc(T('! Atrasada'))}</span>` : ''}
        </div>
        <div class="detalhe-grade">
          <div class="detalhe-principal">
            <section>
              <h3>${esc(T('Descrição'))}</h3>
              <textarea rows="4" data-campo="descricao" data-guardar="descricao" placeholder="${esc(T('Adicione detalhes, links, combinados…'))}">${esc(t.descricao || '')}</textarea>
            </section>
            <section>
              <h3>${esc(T('Checklist'))} ${check.length ? `<span class="contador">${feitos}/${check.length}</span>` : ''}</h3>
              ${check.length ? `<div class="barra" aria-hidden="true"><span style="width:${Math.round((feitos / check.length) * 100)}%"></span></div>` : ''}
              <ul class="checklist">
                ${check.map((c, i) => `
                  <li class="${c.feito ? 'feito' : ''}">
                    <label><input type="checkbox" data-check="${i}" ${c.feito ? 'checked' : ''}> <span>${esc(c.texto)}</span></label>
                    <button type="button" class="botao-icone" data-check-remover="${i}" aria-label="${esc(T('Remover item'))}">×</button>
                  </li>`).join('')}
              </ul>
              <form class="add-linha" data-check-novo>
                <input placeholder="${esc(T('Adicionar item…'))}" maxlength="200" data-guardar="novoItem" data-rascunho>
                <button class="botao-sec">${esc(T('Adicionar'))}</button>
              </form>
            </section>
            <section>
              <h3>${esc(T('Comentários'))} <span class="contador">${(t.comentarios || []).length}</span></h3>
              <ul class="comentarios">
                ${(t.comentarios || []).slice().sort((a, b) => a.em - b.em).map((c) => `
                  <li>${avatar(pessoaDe(c.por))}<div><strong>${esc(nomeDe(c.por))}</strong> <time>${esc(fmtDataHora(c.em))}</time><p>${esc(c.texto)}</p></div></li>`).join('') || `<li class="vazio">${esc(T('Nenhum comentário ainda.'))}</li>`}
              </ul>
              <form class="add-comentario" data-comentar>
                <textarea rows="2" placeholder="${esc(T('Escreva um comentário…'))}" data-guardar="comentario" data-rascunho></textarea>
                <button class="botao">${esc(T('Comentar'))}</button>
              </form>
            </section>
          </div>
          <aside class="detalhe-lateral">
            <label>${esc(T('Responsável'))}<select data-campo="responsavelId">
              ${opcoesResponsavel(t.equipeId, t.responsavelId)}
            </select></label>
            <label>${esc(T('Prazo'))}<input type="date" value="${esc(t.prazo || '')}" data-campo="prazo" data-guardar="prazo"></label>
            <label>${esc(T('Prioridade'))}<select data-campo="prioridade">
              ${PRIORIDADES.map((p) => `<option value="${p.id}" ${p.id === t.prioridade ? 'selected' : ''}>${esc(T(p.nome))}</option>`).join('')}
            </select></label>
            <label>${esc(T('Projeto'))}<select data-campo="projetoId">
              <option value="">${esc(T('Sem projeto'))}</option>
              ${estado.projetos.filter((p) => projetoAberto(p) || p.id === t.projetoId).map((p) => `<option value="${esc(p.id)}" ${p.id === t.projetoId ? 'selected' : ''}>${esc(nomeProjeto(p))}</option>`).join('')}
            </select></label>
            <p class="meta">${T('Equipe de <strong>{nome}</strong>', { nome: esc(nomeDe(t.equipeId)) })}</p>
            <p class="meta">${T('Criada por <strong>{nome}</strong>', { nome: esc(nomeDe(t.criadoPor)) })}<br>${esc(fmtDataHora(t.criadoEm))}</p>
            ${proj ? `<p class="meta"><a href="#/projetos/${esc(proj.id)}" data-fechar>${esc(T('Ver projeto →'))}</a></p>` : ''}
            <details class="historico">
              <summary>${esc(T('Histórico ({n})', { n: (t.historico || []).length }))}</summary>
              <ol>${(t.historico || []).slice().sort((a, b) => b.em - a.em).map((h) => `
                <li><time>${esc(fmtDataHora(h.em))}</time> <strong>${esc(nomeDe(h.por))}</strong> ${esc(textoHistorico(h))}</li>`).join('')}</ol>
            </details>
            ${ger || eu().nivel === 'lider' ? `<button type="button" class="botao-perigo" data-excluir>${esc(T('Excluir tarefa'))}</button>` : ''}
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
          salvar({ checklist: t.checklist.filter((_, j) => j !== i) }, { acao: 'check_rem', valor: item.texto });
          return;
        }
        if (ev.target.closest('[data-excluir]') && confirmar(T('Excluir a tarefa “{t}”? Isso não pode ser desfeito.', { t: t.titulo }))) {
          fonte.excluirTarefa(t.id).then(() => { fecharModal(); aviso(T('Tarefa excluída')); }).catch(erro);
        }
      },
      change: (ev) => {
        const t = tarefa();
        if (!t) return;
        if (ev.target.matches('[data-check]')) {
          const i = Number(ev.target.dataset.check);
          const checklist = t.checklist.map((c, j) => (j === i ? { ...c, feito: ev.target.checked } : c));
          salvar({ checklist }, { acao: ev.target.checked ? 'check_on' : 'check_off', valor: t.checklist[i].texto });
          return;
        }
        // Datas são salvas ao sair do campo (focusout), não a cada tecla.
        if (ev.target.type === 'date') return;
        salvarCampo(ev.target);
      },
      focusout: (ev) => {
        if (ev.target.type === 'date' && ev.target.dataset.campo) salvarCampo(ev.target);
      },
      submit: (ev) => {
        ev.preventDefault();
        submeter(ev);
      },
      keydown: (ev) => {
        // Ctrl+Enter envia o comentário.
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.closest('[data-comentar]')) {
          ev.target.closest('form').requestSubmit();
        }
      }
    }
  });

  function salvarCampo(el) {
        const t = tarefa();
        if (!t) return;
        const campo = el.dataset.campo;
        if (!campo) return;
        let valor = el.value;
        // Data incompleta (ano 0002 etc.): não salva; volta ao valor gravado.
        if (el.type === 'date' && valor && !anoCompleto(valor)) { el.value = t[campo] || ''; return; }
        if (campo === 'titulo') { valor = valor.trim(); if (!valor) { ev.target.value = t.titulo; return; } }
        if (campo === 'descricao') valor = valor.trim();
        if ((campo === 'prazo' || campo === 'projetoId') && !valor) valor = null;
        if ((t[campo] ?? null) === valor) return;
        const acao = { responsavelId: 'responsavel', projetoId: 'projeto' }[campo] || campo;
        salvar({ [campo]: valor }, { acao, valor: campo === 'descricao' ? null : valor });
        if (campo === 'responsavelId') notificarAtribuida({ ...t, responsavelId: valor });
  }

  function submeter(ev) {
        const t = tarefa();
        if (!t) return;
        if (ev.target.matches('[data-check-novo]')) {
          const inp = ev.target.querySelector('input');
          const texto = inp.value.trim();
          if (!texto) return;
          inp.value = '';
          salvar({ checklist: [...(t.checklist || []), { texto, feito: false }] }, { acao: 'check_add', valor: texto });
        }
        if (ev.target.matches('[data-comentar]')) {
          const ta = ev.target.querySelector('textarea');
          const texto = ta.value.trim();
          if (!texto) return;
          ta.value = '';
          fonte.comentar(t.id, texto, eu().id).then(() => notificarComentario(t, texto)).catch(erro);
        }
  }
}
