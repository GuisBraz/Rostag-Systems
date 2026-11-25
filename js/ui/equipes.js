/* Nomes de equipes para a tela: "Equipe Ana Souza" ou "Sem líder · Fábio Neves". */

import { estado, nomeDe } from '../estado.js';
import { ehGerente, lideresDe, ehSemLider } from '../dominio/regras.js';
import { t } from '../i18n.js';

export function nomeEquipe(equipeId) {
  if (!equipeId) return '—';
  if (ehSemLider(equipeId, estado.usuarios)) return t('Sem líder · {nome}', { nome: nomeDe(equipeId) });
  return t('Equipe {nome}', { nome: nomeDe(equipeId) });
}

/** "Todas as equipes", "Equipe de Ana", "Equipes de Ana e Bruno" ou "Sem líder". */
export function alcanceDe(u) {
  if (ehGerente(u)) return t('Todas as equipes');
  if (u.nivel === 'lider') return t('Equipe de {nome}', { nome: u.nome });
  const lideres = lideresDe(u).map(nomeDe);
  if (!lideres.length) return t('Sem líder');
  if (lideres.length === 1) return t('Equipe de {nome}', { nome: lideres[0] });
  return t('Equipes de {nomes}', { nomes: `${lideres.slice(0, -1).join(', ')} ${t('e')} ${lideres[lideres.length - 1]}` });
}

/** Equipes que a gerência/ADM enxerga como opção: líderes e áreas "Sem líder" de analistas sem líder. */
export function todasAsEquipes() {
  const lideres = estado.usuarios.filter((u) => u.nivel === 'lider').map((l) => l.id);
  const semLider = estado.usuarios.filter((u) => u.nivel === 'analista' && !lideresDe(u).length).map((a) => a.id);
  return [...lideres, ...semLider];
}
