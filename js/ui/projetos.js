/* Projetos: lista (visível para todos), página do projeto e formulário. */

import { estado, fonte, nomeDe } from '../estado.js';
import { podeCriarProjeto, ehGerente, atrasada, STATUS } from '../dominio/regras.js';
import { fmtData } from '../dominio/datas.js';
import { esc, abrirModal, fecharModal, aviso, erro } from './base.js';
import { cartaoTarefa } from './tarefas.js';

function progresso(tarefas) {
  const total = tarefas.length;
  const feitas = tarefas.filter((t) => t.status === 'concluida').length;
  return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

export function renderProjetos() {
  const eu = estado.usuario;
  const ordenar = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999');
  const abertos = estado.projetos.filter((p) => p.status !== 'concluido').sort(ordenar);
  const concluidos = estado.projetos.filter((p) => p.status === 'concluido').sort(ordenar);

  const card = (p) => {
    const tarefas = estado.tarefas.filter((t) => t.projetoId === p.id);
    const pr = progresso(tarefas);
    const atras = tarefas.filter((t) => atrasada(t)).length;
    return `
      <a class="card-projeto ${p.status === 'concluido' ? 'concluido' : ''}" href="#/projetos/${esc(p.id)}">
        <h3>${esc(p.nome)}</h3>
        ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
        <div class="barra" aria-label="${pr.pct}% concluído"><span style="width:${pr.pct}%"></span></div>
        <div class="cp-rodape">
          <span>${pr.feitas}/${pr.total} tarefas${ehGerente(eu) ? '' : ' da equipe'}</span>
          ${atras ? `<span class="prazo atrasada">${atras} atrasada${atras > 1 ? 's' : ''}</span>` : ''}
          ${p.prazo ? `<span class="prazo">${esc(fmtData(p.prazo))}</span>` : ''}
        </div>
      </a>`;
  };

  return `
    <header class="titulo-pagina">
      <h1>Projetos</h1>
      <p>${abertos.length} em aberto · ${concluidos.length} concluído${concluidos.length === 1 ? '' : 's'}</p>
      ${podeCriarProjeto(eu) ? '<button class="botao" data-novo-projeto>+ Novo projeto</button>' : ''}
    </header>
    ${abertos.length ? `<div class="grade-projetos">${abertos.map(card).join('')}</div>` : '<p class="vazio">Nenhum projeto em aberto.</p>'}
    ${concluidos.length ? `<details class="grupo"><summary><h2>Concluídos <span class="contador">${concluidos.length}</span></h2></summary>
      <div class="grade-projetos">${concluidos.map(card).join('')}</div></details>` : ''}`;
}

export function renderProjeto(id) {
  const p = estado.projetos.find((x) => x.id === id);
  if (!p) return '<p class="vazio">Projeto não encontrado. <a href="#/projetos">Voltar</a></p>';
  const eu = estado.usuario;
  const tarefas = estado.tarefas.filter((t) => t.projetoId === id);
  const pr = progresso(tarefas);
  return `
    <a class="voltar" href="#/projetos">← Projetos</a>
    <header class="titulo-pagina">
      <h1>${esc(p.nome)}</h1>
      ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
      <p class="meta-centro">
        ${p.status === 'concluido' ? '<span class="selo-texto ok">Concluído</span>' : '<span class="selo-texto">Em aberto</span>'}
        ${p.prazo ? ` · Prazo ${esc(fmtData(p.prazo))}` : ''} · Criado por ${esc(nomeDe(p.criadoPor))}
      </p>
      <div class="barra barra-larga" aria-label="${pr.pct}% concluído"><span style="width:${pr.pct}%"></span></div>
      <p class="meta-centro">${pr.pct}% · ${pr.feitas} de ${pr.total} tarefas concluídas${ehGerente(eu) ? '' : ' (da sua equipe)'}</p>
      <div class="acoes">
        ${p.status !== 'concluido' ? `<button class="botao" data-nova-tarefa data-projeto="${esc(p.id)}">+ Nova tarefa</button>` : ''}
        ${podeCriarProjeto(eu) ? `<button class="botao-sec" data-editar-projeto="${esc(p.id)}">Editar projeto</button>` : ''}
      </div>
    </header>
    <div class="grupos">
      ${STATUS.map((s) => {
        const itens = tarefas.filter((t) => t.status === s.id);
        return itens.length ? `<section class="grupo"><h2>${esc(s.nome)} <span class="contador">${itens.length}</span></h2>
          <div class="grade-cards">${itens.map((t) => cartaoTarefa(t)).join('')}</div></section>` : '';
      }).join('') || '<p class="vazio">Nenhuma tarefa visível neste projeto.</p>'}
    </div>`;
}

export function formProjeto(id = null) {
  const p = id ? estado.projetos.find((x) => x.id === id) : null;
  abrirModal({
    render: () => `
      <form class="form" data-form-projeto>
        <header class="modal-topo"><h2>${p ? 'Editar projeto' : 'Novo projeto'}</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></header>
        <label>Nome<input name="nome" required maxlength="100" value="${esc(p ? p.nome : '')}" autofocus data-guardar="nome" data-rascunho></label>
        <label>Descrição<textarea name="descricao" rows="3" data-guardar="descricao" data-rascunho>${esc(p ? p.descricao : '')}</textarea></label>
        <div class="form-linha">
          <label>Prazo<input type="date" name="prazo" value="${esc(p ? p.prazo || '' : '')}" data-guardar="prazo" data-rascunho></label>
          ${p ? `<label>Situação<select name="status" data-guardar="status" data-rascunho>
            <option value="aberto" ${p.status !== 'concluido' ? 'selected' : ''}>Em aberto</option>
            <option value="concluido" ${p.status === 'concluido' ? 'selected' : ''}>Concluído</option>
          </select></label>` : ''}
        </div>
        <footer class="modal-rodape"><button type="button" class="botao-sec" data-fechar>Cancelar</button><button class="botao">${p ? 'Salvar' : 'Criar projeto'}</button></footer>
      </form>`,
    eventos: {
      click: (ev) => { if (ev.target.closest('[data-fechar]')) fecharModal(); },
      submit: (ev) => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.target));
        const dados = { nome: d.nome.trim(), descricao: d.descricao.trim(), prazo: d.prazo || null };
        if (p) dados.status = d.status;
        else dados.criadoPor = estado.usuario.id;
        if (!dados.nome) return;
        fonte.salvarProjeto(dados, p ? p.id : null)
          .then(() => { fecharModal(); aviso(p ? 'Projeto salvo' : 'Projeto criado'); }).catch(erro);
      }
    }
  });
}
