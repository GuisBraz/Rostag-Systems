/* Fonte de dados do MODO DEMONSTRAÇÃO: tudo no localStorage deste navegador.
   Mesma interface da fonte Firebase (firebase.js). */

import { hojeISO } from '../dominio/datas.js';
import { tarefasVisiveis, VALIDADE_CONVITE_MS } from '../dominio/regras.js';

const CHAVE = 'rostag-systems-demo-v1';
const CHAVE_SESSAO = 'rostag-systems-demo-sessao';

let banco = null;
const ouvintes = { sessao: new Set(), usuarios: new Set(), projetos: new Set(), tarefas: new Set(), convites: new Set() };

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const copia = (x) => JSON.parse(JSON.stringify(x));

function ler(chave) { try { return localStorage.getItem(chave); } catch { return null; } }
function gravar(chave, v) { try { localStorage.setItem(chave, v); } catch { /* navegador sem storage */ } }

function diaRel(n) { const d = new Date(); d.setDate(d.getDate() + n); return hojeISO(d); }
function msRel(dias, hora = 9) { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(hora, 0, 0, 0); return d.getTime(); }

function semente() {
  const u = [
    { id: 'u-gui', nome: 'Gui', email: 'gerencia@demo', nivel: 'gerente', liderId: null },
    { id: 'u-ana', nome: 'Ana Souza', email: 'ana@demo', nivel: 'lider', liderId: null },
    { id: 'u-bruno', nome: 'Bruno Lima', email: 'bruno@demo', nivel: 'lider', liderId: null },
    { id: 'u-carla', nome: 'Carla Dias', email: 'carla@demo', nivel: 'analista', liderId: 'u-ana' },
    { id: 'u-diego', nome: 'Diego Melo', email: 'diego@demo', nivel: 'analista', liderId: 'u-ana' },
    { id: 'u-elisa', nome: 'Elisa Rocha', email: 'elisa@demo', nivel: 'analista', liderId: 'u-bruno' }
  ];
  const p = [
    { id: 'p-site', nome: 'Novo site institucional', descricao: 'Reformular o site da empresa.', status: 'aberto', prazo: diaRel(30), criadoPor: 'u-gui', criadoEm: msRel(-20) },
    { id: 'p-linha', nome: 'Melhoria da linha 2', descricao: 'Reduzir paradas na linha 2.', status: 'aberto', prazo: diaRel(45), criadoPor: 'u-bruno', criadoEm: msRel(-15) },
    { id: 'p-iso', nome: 'Auditoria ISO 9001', descricao: 'Preparar a documentação para a auditoria.', status: 'aberto', prazo: diaRel(12), criadoPor: 'u-gui', criadoEm: msRel(-10) },
    { id: 'p-inv', nome: 'Inventário anual', descricao: '', status: 'concluido', prazo: diaRel(-5), criadoPor: 'u-ana', criadoEm: msRel(-40) }
  ];
  const t = (o) => {
    const criadoEm = o.criadoEm || msRel(-7);
    return {
      id: id(), descricao: '', prioridade: 'media', checklist: [], comentarios: [],
      criadoEm, atualizadoEm: criadoEm, concluidaEm: null,
      historico: [{ em: criadoEm, por: o.criadoPor, acao: 'criou' }],
      ...o
    };
  };
  const tarefas = [
    t({ titulo: 'Definir layout da página inicial', projetoId: 'p-site', equipeId: 'u-ana', responsavelId: 'u-carla', status: 'andamento', prioridade: 'alta', prazo: diaRel(2), criadoPor: 'u-ana',
      descricao: 'Montar duas opções de layout para apresentar à gerência.',
      checklist: [{ texto: 'Levantar referências', feito: true }, { texto: 'Opção A', feito: true }, { texto: 'Opção B', feito: false }],
      comentarios: [{ em: msRel(-2, 14), por: 'u-ana', texto: 'Usar as cores azul royal e celeste.' }, { em: msRel(-1, 10), por: 'u-carla', texto: 'Opção A pronta, falta a B.' }] }),
    t({ titulo: 'Escrever textos institucionais', projetoId: 'p-site', equipeId: 'u-ana', responsavelId: 'u-diego', status: 'afazer', prazo: diaRel(6), criadoPor: 'u-ana' }),
    t({ titulo: 'Revisar procedimentos de qualidade', projetoId: 'p-iso', equipeId: 'u-ana', responsavelId: 'u-diego', status: 'andamento', prioridade: 'alta', prazo: diaRel(-2), criadoPor: 'u-gui' }),
    t({ titulo: 'Contagem do almoxarifado', projetoId: 'p-inv', equipeId: 'u-ana', responsavelId: 'u-carla', status: 'concluida', prazo: diaRel(-6), criadoPor: 'u-ana', concluidaEm: msRel(-1, 16) }),
    t({ titulo: 'Medir tempo de setup da linha 2', projetoId: 'p-linha', equipeId: 'u-bruno', responsavelId: 'u-elisa', status: 'andamento', prazo: diaRel(3), criadoPor: 'u-bruno',
      checklist: [{ texto: 'Turno A', feito: true }, { texto: 'Turno B', feito: false }] }),
    t({ titulo: 'Levantar paradas do último mês', projetoId: 'p-linha', equipeId: 'u-bruno', responsavelId: 'u-elisa', status: 'afazer', prazo: diaRel(-1), criadoPor: 'u-bruno' }),
    t({ titulo: 'Plano de ação das paradas', projetoId: 'p-linha', equipeId: 'u-bruno', responsavelId: 'u-bruno', status: 'afazer', prioridade: 'baixa', prazo: diaRel(10), criadoPor: 'u-bruno' }),
    t({ titulo: 'Atualizar registros de calibração', projetoId: 'p-iso', equipeId: 'u-bruno', responsavelId: 'u-elisa', status: 'concluida', prazo: diaRel(0), criadoPor: 'u-gui', concluidaEm: msRel(0, 8) })
  ];
  return { usuarios: u, projetos: p, tarefas, convites: [] };
}

function carregar() {
  if (banco) return;
  const bruto = ler(CHAVE);
  try { banco = bruto ? JSON.parse(bruto) : null; } catch { banco = null; }
  if (!banco || !Array.isArray(banco.tarefas)) { banco = semente(); salvar(); }
  if (!Array.isArray(banco.convites)) banco.convites = [];
}
function salvar() { gravar(CHAVE, JSON.stringify(banco)); }

function usuarioAtual() {
  const uid = ler(CHAVE_SESSAO) || 'u-gui';
  return banco.usuarios.find((u) => u.id === uid) || banco.usuarios[0];
}

function emitir() {
  const eu = usuarioAtual();
  ouvintes.sessao.forEach((cb) => cb(copia(eu)));
  ouvintes.usuarios.forEach((cb) => cb(copia(banco.usuarios)));
  ouvintes.projetos.forEach((cb) => cb(copia(banco.projetos)));
  ouvintes.tarefas.forEach((cb) => cb(copia(tarefasVisiveis(eu, banco.tarefas))));
  ouvintes.convites.forEach((cb) => cb(copia(banco.convites.filter((c) => !c.usado))));
}

function assinar(tipo, cb, valor) {
  ouvintes[tipo].add(cb);
  cb(copia(valor()));
  return () => ouvintes[tipo].delete(cb);
}

function tarefa(idT) {
  const t = banco.tarefas.find((x) => x.id === idT);
  if (!t) throw new Error('Tarefa não encontrada.');
  return t;
}

export const fonteLocal = {
  modo: 'demo',
  iniciar() { carregar(); },
  aoMudarSessao(cb) { return assinar('sessao', cb, usuarioAtual); },
  async entrar() { /* sem login no modo demo */ },
  async cadastrar() { throw new Error('No modo demonstração não há cadastro.'); },
  async sair() { /* sem login no modo demo */ },

  observarUsuarios(cb) { return assinar('usuarios', cb, () => banco.usuarios); },
  observarProjetos(cb) { return assinar('projetos', cb, () => banco.projetos); },
  observarTarefas(_usuario, cb) { return assinar('tarefas', cb, () => tarefasVisiveis(usuarioAtual(), banco.tarefas)); },

  async salvarProjeto(dados, idP) {
    if (idP) Object.assign(banco.projetos.find((p) => p.id === idP), dados);
    else banco.projetos.push({ id: id(), status: 'aberto', criadoEm: Date.now(), ...dados });
    salvar(); emitir();
  },
  async criarTarefa(dados, autorId) {
    const agora = Date.now();
    const nova = { id: id(), checklist: [], comentarios: [], concluidaEm: null, ...dados,
      criadoPor: autorId, criadoEm: agora, atualizadoEm: agora,
      historico: [{ em: agora, por: autorId, acao: 'criou' }] };
    banco.tarefas.push(nova); salvar(); emitir();
    return nova.id;
  },
  async atualizarTarefa(idT, patch, autorId, eventos = []) {
    const t = tarefa(idT);
    const agora = Date.now();
    Object.assign(t, patch, { atualizadoEm: agora });
    eventos.forEach((ev) => t.historico.push({ em: agora, por: autorId, ...ev }));
    salvar(); emitir();
  },
  async comentar(idT, texto, autorId) {
    const t = tarefa(idT);
    const agora = Date.now();
    t.comentarios.push({ em: agora, por: autorId, texto });
    t.atualizadoEm = agora;
    salvar(); emitir();
  },
  async excluirTarefa(idT) { banco.tarefas = banco.tarefas.filter((t) => t.id !== idT); salvar(); emitir(); },
  async lerConvite(codigo) { return copia(banco.convites.find((c) => c.id === codigo) || null); },
  observarConvites(cb) { return assinar('convites', cb, () => banco.convites.filter((c) => !c.usado)); },
  async criarConvite(dados, autorId) {
    const agora = Date.now();
    const c = { id: id() + id(), ...dados, criadoPor: autorId, criadoEm: agora, expiraEm: agora + VALIDADE_CONVITE_MS, usado: false };
    banco.convites.push(c); salvar(); emitir();
    return c.id;
  },
  async cancelarConvite(codigo) { banco.convites = banco.convites.filter((c) => c.id !== codigo); salvar(); emitir(); },
  async atualizarUsuario(idU, patch) { Object.assign(banco.usuarios.find((u) => u.id === idU), patch); salvar(); emitir(); },

  // Só no modo demo
  trocarUsuario(idU) { gravar(CHAVE_SESSAO, idU); emitir(); },
  restaurarDemo() { banco = semente(); salvar(); emitir(); }
};
