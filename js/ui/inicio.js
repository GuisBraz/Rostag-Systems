/* Página inicial: saudação, data/hora ao vivo, semana e painel com gráficos. */

import { estado, nomeDe, projetoDe } from '../estado.js';
import { saudacao, dataHoraCurta, semanaISO, fmtData } from '../dominio/datas.js';
import { indicadores, abertasPor, atrasada, ehGerente, NIVEIS, nomeProjeto, tarefasAtivas, podeCriarProjeto } from '../dominio/regras.js';
import { t } from '../i18n.js';
import { pref } from '../prefs.js';
import { esc } from './base.js';
import { alcanceDe, todasAsEquipes } from './equipes.js';

// Paletas dos gráficos, validadas (separação para daltonismo e contraste) — uma por tema.
const PALETA = {
  claro: { afazer: '#5AA9E6', andamento: '#2453C7', concluida: '#14A38B' },
  escuro: { afazer: '#43A0E2', andamento: '#4A5FD8', concluida: '#1FA088' }
};
const NOME_SERIE = { afazer: 'A fazer', andamento: 'Em andamento', concluida: 'Concluída' };
const cores = () => PALETA[pref('tema') === 'escuro' ? 'escuro' : 'claro'];

let graficos = [];
let relogio = null;

export function primeiroNome(nome) { return String(nome || '').trim().split(/\s+/)[0] || ''; }

export const textoSaudacao = (agora, nome) => `${t(saudacao(agora))} ${primeiroNome(nome)}`;
export const textoSemana = (agora) => t('Semana {n}', { n: semanaISO(agora) });

function cabecalho() {
  const agora = new Date();
  return `
    <section class="saudacao" aria-live="polite">
      <h1 id="ola">${esc(textoSaudacao(agora, estado.usuario.nome))}</h1>
      <p id="relogio">${esc(dataHoraCurta(agora))}</p>
      <p id="semana">${esc(textoSemana(agora))}</p>
    </section>`;
}

function tile(rotulo, valor, extra = '', dica = '') {
  return `<div class="tile ${extra}" ${dica ? `title="${esc(t(dica))}"` : ''}>
    <span class="tile-valor">${valor}</span><span class="tile-rotulo">${esc(t(rotulo))}</span></div>`;
}

export function renderInicio() {
  const u = estado.usuario;
  const tarefas = tarefasAtivas(estado.tarefas, estado.projetos);
  const ind = indicadores(tarefas, estado.projetos);
  // Sem nenhuma equipe ainda (nem líder, nem analista): só a gerência vê o aviso de convidar.
  const semEquipe = ehGerente(u) && !todasAsEquipes().length;
  const alcance = alcanceDe(u);
  const atrasadas = tarefas.filter((x) => atrasada(x)).sort((a, b) => a.prazo.localeCompare(b.prazo));

  return `
    ${cabecalho()}
    <p class="alcance">${esc(t(NIVEIS[u.nivel]))} · ${esc(alcance)}</p>
    <div class="acoes acoes-inicio">
      ${semEquipe ? '' : `<button class="botao" data-nova-tarefa>${esc(t('+ Nova tarefa'))}</button>`}
      ${podeCriarProjeto(u) ? `<button class="botao-sec" data-novo-projeto>${esc(t('+ Novo projeto'))}</button>` : ''}
    </div>
    ${semEquipe && ehGerente(u) ? `
      <div class="cartao aviso-inicio">
        <strong>${esc(t('Comece convidando um líder'))}</strong>
        <p>${esc(t('Toda tarefa pertence à equipe de um líder. Convide o primeiro líder para começar a criar tarefas.'))}</p>
        <a class="botao" href="#/config/equipe">${esc(t('Convidar pessoa'))}</a>
      </div>` : ''}

    <section class="tiles" aria-label="Indicadores">
      ${tile('Projetos em aberto', ind.projetosAbertos)}
      ${tile('Tarefas em aberto', ind.tarefasAbertas)}
      ${tile('Tarefas pendentes', ind.pendentes, ind.pendentes ? 'tile-alerta' : '', 'Prazo vencido e ainda não concluídas')}
      ${tile('Vencem nesta semana', ind.venceSemana)}
      ${tile('Concluídas na semana', ind.concluidasSemana, 'tile-ok')}
    </section>

    <section class="paineis">
      <article class="cartao">
        <h2>${esc(t('Tarefas por status'))}</h2>
        <div class="grafico grafico-baixo"><canvas id="g-status" aria-label="${esc(t('Tarefas por status'))}"></canvas></div>
      </article>
      <article class="cartao">
        <h2>${esc(t('Tarefas por projeto'))}</h2>
        <div class="grafico" id="g-projetos-caixa"><canvas id="g-projetos" aria-label="${esc(t('Tarefas por projeto'))}"></canvas></div>
      </article>
      <article class="cartao">
        <h2>${esc(t('Tarefas abertas por responsável'))}</h2>
        <div class="grafico" id="g-pessoas-caixa"><canvas id="g-pessoas" aria-label="${esc(t('Tarefas abertas por responsável'))}"></canvas></div>
      </article>
      <article class="cartao">
        <h2>${esc(t('Tarefas pendentes'))} <span class="contador ${atrasadas.length ? 'contador-alerta' : ''}">${atrasadas.length}</span></h2>
        ${atrasadas.length ? `<ul class="lista-simples">${atrasadas.slice(0, 8).map((x) => `
          <li><button class="linha-tarefa" data-abrir-tarefa="${esc(x.id)}">
            <span class="selo selo-atrasada" aria-hidden="true">!</span>
            <span class="lt-titulo">${esc(x.titulo)}<small>${esc(nomeProjeto(projetoDe(x.projetoId)) || t('Sem projeto'))} · ${esc(nomeDe(x.responsavelId))}</small></span>
            <span class="lt-prazo atrasada">${esc(fmtData(x.prazo))}</span>
          </button></li>`).join('')}</ul>` : `<p class="vazio">${esc(t('Nenhuma tarefa atrasada. 👏'))}</p>`}
      </article>
    </section>`;
}

/** Cores de texto/grade lidas do tema atual (variáveis CSS). */
function corVar(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }

function opcoesBase(Chart) {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = corVar('--tinta-2');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, padding: 14 } },
      tooltip: { backgroundColor: '#14254A', padding: 10, cornerRadius: 8, boxPadding: 4 }
    }
  };
}

function barrasEmpilhadas(canvas, rotulos, series, Chart) {
  const base = opcoesBase(Chart);
  const c = cores();
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: series.map((s) => ({
        label: t(NOME_SERIE[s.id]), data: s.valores, backgroundColor: c[s.id],
        borderColor: corVar('--superficie'), borderWidth: { left: 0, right: 2, top: 0, bottom: 0 }, borderSkipped: false,
        borderRadius: 4, barThickness: 16
      }))
    },
    options: {
      ...base,
      indexAxis: 'y',
      layout: { padding: { left: 8 } },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: corVar('--borda') }, border: { display: false } },
        y: { stacked: true, grid: { display: false }, border: { display: false } }
      },
      plugins: { ...base.plugins, tooltip: { ...base.plugins.tooltip, mode: 'index', intersect: false } }
    }
  });
}

export function montarInicio(raiz) {
  // Relógio ao vivo (atualiza a cada segundo só os textos do topo).
  clearInterval(relogio);
  relogio = setInterval(() => {
    const ola = raiz.querySelector('#ola');
    if (!ola) { clearInterval(relogio); return; }
    const agora = new Date();
    ola.textContent = textoSaudacao(agora, estado.usuario.nome);
    raiz.querySelector('#relogio').textContent = dataHoraCurta(agora);
    raiz.querySelector('#semana').textContent = textoSemana(agora);
  }, 1000);

  graficos.forEach((g) => g.destroy());
  graficos = [];
  const Chart = window.Chart;
  if (!Chart) return;
  const tarefas = tarefasAtivas(estado.tarefas, estado.projetos);
  const c = cores();

  // 1. Status (rosca).
  const ind = indicadores(tarefas, estado.projetos);
  const ids = ['afazer', 'andamento', 'concluida'];
  const base = opcoesBase(Chart);
  graficos.push(new Chart(raiz.querySelector('#g-status'), {
    type: 'doughnut',
    data: {
      labels: ids.map((i) => `${t(NOME_SERIE[i])} (${ind.porStatus[i]})`),
      datasets: [{ data: ids.map((i) => ind.porStatus[i]), backgroundColor: ids.map((i) => c[i]), borderColor: corVar('--superficie'), borderWidth: 2, hoverOffset: 4 }]
    },
    options: { ...base, cutout: '68%', plugins: { ...base.plugins, legend: { ...base.plugins.legend, position: 'right' } } }
  }));

  // 2. Por projeto (só projetos com tarefas visíveis).
  const porProj = abertasPor('projetoId', tarefas);
  const projs = [...porProj.keys()].map((id) => ({ id, nome: nomeProjeto(projetoDe(id)) || t('Sem projeto'), g: porProj.get(id) }))
    .sort((a, b) => (b.g.afazer + b.g.andamento) - (a.g.afazer + a.g.andamento));
  ajustarAltura(raiz.querySelector('#g-projetos-caixa'), projs.length);
  graficos.push(barrasEmpilhadas(raiz.querySelector('#g-projetos'), projs.map((p) => cortar(p.nome)),
    ids.map((id) => ({ id, valores: projs.map((p) => p.g[id] || 0) })), Chart));

  // 3. Abertas por responsável.
  const abertas = tarefas.filter((x) => x.status !== 'concluida');
  const porPessoa = abertasPor('responsavelId', abertas);
  const pessoas = [...porPessoa.keys()].map((id) => ({ id, nome: nomeDe(id), g: porPessoa.get(id) }))
    .sort((a, b) => (b.g.afazer + b.g.andamento) - (a.g.afazer + a.g.andamento));
  ajustarAltura(raiz.querySelector('#g-pessoas-caixa'), pessoas.length);
  graficos.push(barrasEmpilhadas(raiz.querySelector('#g-pessoas'), pessoas.map((p) => p.nome),
    ['afazer', 'andamento'].map((id) => ({ id, valores: pessoas.map((p) => p.g[id] || 0) })), Chart));
}

function ajustarAltura(caixa, n) { caixa.style.height = `${Math.max(180, 70 + n * 34)}px`; }
function cortar(s) { return s.length > 20 ? `${s.slice(0, 19)}…` : s; }

export function desmontarInicio() {
  clearInterval(relogio);
  graficos.forEach((g) => g.destroy());
  graficos = [];
}
