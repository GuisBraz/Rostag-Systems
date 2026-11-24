/* Equipe (só gerência): nível de cada pessoa e a qual líder cada analista pertence. */

import { estado, fonte } from '../estado.js';
import { NIVEIS } from '../dominio/regras.js';
import { esc, avatar, aviso, erro } from './base.js';

export function renderEquipe() {
  const pessoas = estado.usuarios.slice().sort((a, b) =>
    (a.nivel === 'pendente' ? -1 : 0) - (b.nivel === 'pendente' ? -1 : 0) || a.nome.localeCompare(b.nome));
  const lideres = estado.usuarios.filter((u) => u.nivel === 'lider');
  const pendentes = pessoas.filter((u) => u.nivel === 'pendente').length;

  const linha = (u) => `
    <tr class="${u.nivel === 'pendente' ? 'linha-pendente' : ''}">
      <td><div class="pessoa">${avatar(u.nome)}<div><strong>${esc(u.nome)}</strong><small>${esc(u.email || '')}</small></div></div></td>
      <td>${u.id === estado.usuario.id ? `<span class="selo-texto">${esc(NIVEIS[u.nivel])}</span>` : `
        <select data-nivel="${esc(u.id)}" aria-label="Nível de ${esc(u.nome)}">
          ${Object.entries(NIVEIS).map(([id, nome]) => `<option value="${id}" ${id === u.nivel ? 'selected' : ''}>${esc(nome)}</option>`).join('')}
        </select>`}</td>
      <td>${u.nivel === 'analista' ? `
        <select data-lider="${esc(u.id)}" aria-label="Líder de ${esc(u.nome)}">
          <option value="">Sem líder</option>
          ${lideres.map((l) => `<option value="${esc(l.id)}" ${l.id === u.liderId ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}
        </select>` : '<span class="meta">—</span>'}</td>
    </tr>`;

  return `
    <header class="titulo-pagina">
      <h1>Equipe</h1>
      <p>${lideres.length} líder${lideres.length === 1 ? '' : 'es'} · ${estado.usuarios.filter((u) => u.nivel === 'analista').length} analistas
        ${pendentes ? ` · <strong class="texto-alerta">${pendentes} aguardando liberação</strong>` : ''}</p>
    </header>
    <div class="organograma">
      ${lideres.map((l) => `
        <div class="org-equipe">
          <div class="org-lider">${avatar(l.nome)}<strong>${esc(l.nome)}</strong><small>Líder</small></div>
          <ul>${estado.usuarios.filter((a) => a.nivel === 'analista' && a.liderId === l.id).map((a) => `<li>${avatar(a.nome, 'avatar-p')}${esc(a.nome)}</li>`).join('') || '<li class="meta">Sem analistas</li>'}</ul>
        </div>`).join('') || '<p class="vazio">Defina pelo menos um líder abaixo.</p>'}
    </div>
    <div class="tabela-caixa">
      <table class="tabela">
        <thead><tr><th>Pessoa</th><th>Nível</th><th>Líder</th></tr></thead>
        <tbody>${pessoas.map(linha).join('')}</tbody>
      </table>
    </div>
    <p class="meta-centro">Quem cria conta entra como “Aguardando liberação” e só vê o sistema depois que a gerência definir o nível.</p>`;
}

export function montarEquipe(raiz) {
  raiz.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.nivel) {
      const patch = { nivel: el.value };
      if (el.value !== 'analista') patch.liderId = null;
      fonte.atualizarUsuario(el.dataset.nivel, patch).then(() => aviso('Nível atualizado')).catch(erro);
    }
    if (el.dataset.lider !== undefined) {
      fonte.atualizarUsuario(el.dataset.lider, { liderId: el.value || null }).then(() => aviso('Líder atualizado')).catch(erro);
    }
  });
}
