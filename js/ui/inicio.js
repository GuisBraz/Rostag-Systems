/* Página inicial: saudação, data/hora ao vivo, semana e painel com gráficos. */

import { estado, nomeDe, projetoDe } from '../estado.js';
import { saudacao, dataHoraCurta, semanaISO, fmtData } from '../dominio/datas.js';
import { indicadores, abertasPor, atrasada, ehGerente, equipeDe, NIVEIS } from '../dominio/regras.js';
import { esc } from './base.js';

// Paleta dos gráficos (validada: separação para daltonismo e contraste com rótulos visíveis).
export const COR_STATUS = { afazer: '#5AA9E6', andamento: '#2453C7', concluida: '#14A38B' };
const NOME_SERIE = { afazer: 'A fazer', andamento: 'Em andamento', concluida: 'Concluída' };

let graficos = [];
let relogio = null;

export function primeiroNome(nome) { return String(nome || '').trim().split(/\s+/)[0] || ''; }

function cabecalho() {
  const agora = new Date();
  return `
    <section class="saudacao" aria-live="polite">
      <h1 id="ola">${esc(saudacao(agora))} ${esc(primeiroNome(estado.usuario.nome))}</h1>
      <p id="relogio">${esc(dataHoraCurta(agora))}</p>
      <p id="semana">Semana ${semanaISO(agora)}</p>
    </section>`;
}

function tile(rotulo, valor, extra = '', dica = '') {
  return `<div class="tile ${extra}" ${dica ? `title="${esc(dica)}"` : ''}>
    <span class="tile-valor">${valor}</span><span class="tile-rotulo">${esc(rotulo)}</span></div>`;
}

export function renderInicio() {
  const u = estado.usuario;
  const ind = indicadores(estado.tarefas, estado.projetos);
  const alcance = ehGerente(u) ? 'Todas as equipes' : `Equipe de ${nomeDe(equipeDe(u))}`;
  const atrasadas = estado.tarefas.filter((t) => atrasada(t)).sort((a, b) => a.prazo.localeCompare(b.prazo));

  return `
    ${cabecalho()}
    <p class="alcance">${esc(NIVEIS[u.nivel])} · ${esc(alcance)}</p>

    <section class="tiles" aria-label="Indicadores">
      ${tile('Projetos em aberto', ind.projetosAbertos)}
      ${tile('Tarefas em aberto', ind.tarefasAbertas)}
      ${tile('Tarefas pendentes', ind.pendentes, ind.pendentes ? 'tile-alerta' : '', 'Prazo vencido e ainda não concluídas')}
      ${tile('Vencem nesta semana', ind.venceSemana)}
      ${tile('Concluídas na semana', ind.concluidasSemana, 'tile-ok')}
    </section>

    <section class="paineis">
      <article class="cartao">
        <h2>Tarefas por status</h2>
        <div class="grafico grafico-baixo"><canvas id="g-status" aria-label="Tarefas por status"></canvas></div>
      </article>
      <article class="cartao">
        <h2>Tarefas por projeto</h2>
        <div class="grafico" id="g-projetos-caixa"><canvas id="g-projetos" aria-label="Tarefas por projeto"></canvas></div>
      </article>
      <article class="cartao">
        <h2>Tarefas abertas por responsável</h2>
        <div class="grafico" id="g-pessoas-caixa"><canvas id="g-pessoas" aria-label="Tarefas abertas por responsável"></canvas></div>
      </article>
      <article class="cartao">
        <h2>Tarefas pendentes <span class="contador ${atrasadas.length ? 'contador-alerta' : ''}">${atrasadas.length}</span></h2>
        ${atrasadas.length ? `<ul class="lista-simples">${atrasadas.slice(0, 8).map((t) => `
          <li><button class="linha-tarefa" data-abrir-tarefa="${esc(t.id)}">
            <span class="selo selo-atrasada" aria-hidden="true">!</span>
            <span class="lt-titulo">${esc(t.titulo)}<small>${esc((projetoDe(t.projetoId) || {}).nome || 'Sem projeto')} · ${esc(nomeDe(t.responsavelId))}</small></span>
            <span class="lt-prazo atrasada">${esc(fmtData(t.prazo))}</span>
          </button></li>`).join('')}</ul>` : '<p class="vazio">Nenhuma tarefa atrasada. 👏</p>'}
      </article>
    </section>`;
}

function opcoesBase(Chart) {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#5B6B86';
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
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: series.map((s) => ({
        label: NOME_SERIE[s.id], data: s.valores, backgroundColor: COR_STATUS[s.id],
        borderColor: '#FFFFFF', borderWidth: { left: 0, right: 2, top: 0, bottom: 0 }, borderSkipped: false,
        borderRadius: 4, barThickness: 16
      }))
    },
    options: {
      ...base,
      indexAxis: 'y',
      layout: { padding: { left: 8 } },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#E8EEF7' }, border: { display: false } },
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
    ola.textContent = `${saudacao(agora)} ${primeiroNome(estado.usuario.nome)}`;
    raiz.querySelector('#relogio').textContent = dataHoraCurta(agora);
    raiz.querySelector('#semana').textContent = `Semana ${semanaISO(agora)}`;
  }, 1000);

  graficos.forEach((g) => g.destroy());
  graficos = [];
  const Chart = window.Chart;
  if (!Chart) return;
  const tarefas = estado.tarefas;

  // 1. Status (rosca) com total no centro.
  const ind = indicadores(tarefas, estado.projetos);
  const ids = ['afazer', 'andamento', 'concluida'];
  const base = opcoesBase(Chart);
  graficos.push(new Chart(raiz.querySelector('#g-status'), {
    type: 'doughnut',
    data: {
      labels: ids.map((i) => `${NOME_SERIE[i]} (${ind.porStatus[i]})`),
      datasets: [{ data: ids.map((i) => ind.porStatus[i]), backgroundColor: ids.map((i) => COR_STATUS[i]), borderColor: '#FFFFFF', borderWidth: 2, hoverOffset: 4 }]
    },
    options: { ...base, cutout: '68%', plugins: { ...base.plugins, legend: { ...base.plugins.legend, position: 'right' } } }
  }));

  // 2. Por projeto (só projetos com tarefas visíveis).
  const porProj = abertasPor('projetoId', tarefas);
  const projs = [...porProj.keys()].map((id) => ({ id, nome: (projetoDe(id) || {}).nome || 'Sem projeto', g: porProj.get(id) }))
    .sort((a, b) => (b.g.afazer + b.g.andamento) - (a.g.afazer + a.g.andamento));
  ajustarAltura(raiz.querySelector('#g-projetos-caixa'), projs.length);
  graficos.push(barrasEmpilhadas(raiz.querySelector('#g-projetos'), projs.map((p) => cortar(p.nome)),
    ids.map((id) => ({ id, valores: projs.map((p) => p.g[id] || 0) })), Chart));

  // 3. Abertas por responsável.
  const abertas = tarefas.filter((t) => t.status !== 'concluida');
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
