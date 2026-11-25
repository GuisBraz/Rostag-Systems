import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saudacao, semanaISO, dataHoraCurta, limitesSemana } from '../js/dominio/datas.js';
import { equipeDe, podeVerTarefa, membrosDaEquipe, atrasada, indicadores, podeCriarProjeto } from '../js/dominio/regras.js';

test('saudação muda com o horário', () => {
  assert.equal(saudacao(new Date(2026, 10, 24, 8, 0)), 'Bom dia');
  assert.equal(saudacao(new Date(2026, 10, 24, 13, 0)), 'Boa tarde');
  assert.equal(saudacao(new Date(2026, 10, 24, 19, 47)), 'Boa noite');
  assert.equal(saudacao(new Date(2026, 10, 24, 2, 0)), 'Boa noite');
});

test('semana ISO', () => {
  assert.equal(semanaISO(new Date(2026, 10, 24)), 48);
  assert.equal(semanaISO(new Date(2026, 0, 1)), 1);   // quinta-feira
  assert.equal(semanaISO(new Date(2027, 0, 1)), 53);  // sexta: ainda semana 53 de 2026
  assert.equal(semanaISO(new Date(2024, 11, 30)), 1); // segunda: semana 1 de 2025
});

test('data e hora no formato do print', () => {
  assert.equal(dataHoraCurta(new Date(2026, 10, 24, 19, 47)), '24/11/26 – 19:47');
});

test('limites da semana vão de segunda a domingo', () => {
  assert.deepEqual(limitesSemana(new Date(2026, 10, 24)), { inicio: '2026-11-23', fim: '2026-11-29' });
  assert.deepEqual(limitesSemana(new Date(2026, 10, 29)), { inicio: '2026-11-23', fim: '2026-11-29' });
});

const ger = { id: 'g', nivel: 'gerente' };
const ana = { id: 'ana', nivel: 'lider' };
const bruno = { id: 'bruno', nivel: 'lider' };
const carla = { id: 'carla', nivel: 'analista', liderId: 'ana' };
const pend = { id: 'p', nivel: 'pendente' };
const tA = { equipeId: 'ana' };
const tB = { equipeId: 'bruno' };

test('equipe: líder é a própria; analista é a do líder', () => {
  assert.equal(equipeDe(ana), 'ana');
  assert.equal(equipeDe(carla), 'ana');
  assert.equal(equipeDe(ger), null);
});

test('visibilidade: gerente tudo, equipe só a sua, pendente nada', () => {
  assert.ok(podeVerTarefa(ger, tA) && podeVerTarefa(ger, tB));
  assert.ok(podeVerTarefa(ana, tA) && !podeVerTarefa(ana, tB));
  assert.ok(podeVerTarefa(carla, tA) && !podeVerTarefa(carla, tB));
  assert.ok(!podeVerTarefa(bruno, tA));
  assert.ok(!podeVerTarefa(pend, tA));
});

test('projetos: gerente e líder criam, analista não', () => {
  assert.ok(podeCriarProjeto(ger) && podeCriarProjeto(ana));
  assert.ok(!podeCriarProjeto(carla));
});

test('membros da equipe = líder + analistas dele', () => {
  const ids = membrosDaEquipe('ana', [ger, ana, bruno, carla]).map((u) => u.id);
  assert.deepEqual(ids, ['ana', 'carla']);
});

test('pendente = atrasada (prazo vencido e não concluída)', () => {
  assert.ok(atrasada({ status: 'afazer', prazo: '2026-11-20' }, '2026-11-24'));
  assert.ok(!atrasada({ status: 'concluida', prazo: '2026-11-20' }, '2026-11-24'));
  assert.ok(!atrasada({ status: 'afazer', prazo: '2026-11-24' }, '2026-11-24'));
  assert.ok(!atrasada({ status: 'afazer', prazo: null }, '2026-11-24'));
});

test('indicadores do painel', () => {
  const agora = new Date(2026, 10, 24, 10);
  const tarefas = [
    { status: 'afazer', prazo: '2026-11-20' },
    { status: 'andamento', prazo: '2026-11-27' },
    { status: 'concluida', prazo: '2026-11-22', concluidaEm: new Date(2026, 10, 23, 9).getTime() },
    { status: 'concluida', prazo: '2026-11-01', concluidaEm: new Date(2026, 10, 2).getTime() }
  ];
  const projetos = [{ status: 'aberto' }, { status: 'concluido' }, {}];
  const i = indicadores(tarefas, projetos, agora);
  assert.equal(i.projetosAbertos, 2);
  assert.equal(i.tarefasAbertas, 2);
  assert.equal(i.pendentes, 1);
  assert.equal(i.venceSemana, 1);
  assert.equal(i.concluidasSemana, 1);
  assert.deepEqual(i.porStatus, { afazer: 1, andamento: 1, concluida: 2 });
});

import { ehAdm, ehGerente, niveisQuePodeDar, podeEditarPessoa, pessoasVisiveis, conviteValido } from '../js/dominio/regras.js';

const adm = { id: 'adm', nivel: 'adm' };

test('ADM: acima da gerência, vê tudo e cria gerentes', () => {
  assert.ok(ehAdm(adm) && ehGerente(adm));
  assert.ok(podeVerTarefa(adm, tA) && podeVerTarefa(adm, tB));
  assert.ok(podeCriarProjeto(adm));
  assert.ok(niveisQuePodeDar(adm).includes('gerente'));
  assert.ok(!niveisQuePodeDar(ger).includes('gerente'));
  assert.deepEqual(niveisQuePodeDar(carla), []);
});

test('quem pode mudar o nível de quem', () => {
  assert.ok(podeEditarPessoa(adm, ger));
  assert.ok(podeEditarPessoa(ger, carla));
  assert.ok(!podeEditarPessoa(ger, { id: 'g2', nivel: 'gerente' }));
  assert.ok(!podeEditarPessoa(ger, adm));
  assert.ok(!podeEditarPessoa(ger, ger));
  assert.ok(!podeEditarPessoa(ana, carla));
});

test('ADM fica escondido das listas para os outros', () => {
  const todos = [adm, ger, ana, carla];
  assert.ok(!pessoasVisiveis(ger, todos).some((u) => u.nivel === 'adm'));
  assert.ok(!pessoasVisiveis(carla, todos).some((u) => u.nivel === 'adm'));
  assert.equal(pessoasVisiveis(adm, todos).length, 4);
});

test('convite: vale até vencer e só uma vez', () => {
  const agora = 1000;
  assert.ok(conviteValido({ usado: false, expiraEm: 2000 }, agora));
  assert.ok(!conviteValido({ usado: true, expiraEm: 2000 }, agora));
  assert.ok(!conviteValido({ usado: false, expiraEm: 500 }, agora));
  assert.ok(!conviteValido(null, agora));
});

import { commessaValida, nomeProjeto, projetoEhMeu, tarefasAtivas, situacaoPeriodo } from '../js/dominio/regras.js';

test('commessa AAAA-NNN e nome do projeto', () => {
  assert.ok(commessaValida('2025-006'));
  assert.ok(!commessaValida('25-006') && !commessaValida('2025-6') && !commessaValida(''));
  assert.equal(nomeProjeto({ commessa: '2025-006', nome: 'Plataforma TP01' }), '2025-006 · Plataforma TP01');
  assert.equal(nomeProjeto({ nome: 'Antigo' }), 'Antigo');
});

test('projeto "meu": líder, analista responsável ou quem criou', () => {
  const p = { liderId: 'ana', analistaIds: ['carla'], criadoPor: 'g' };
  assert.ok(projetoEhMeu(ana, p) && projetoEhMeu(carla, p) && projetoEhMeu(ger, p));
  assert.ok(!projetoEhMeu(bruno, p));
});

test('tarefas de projeto arquivado somem', () => {
  const projetos = [{ id: 'a', status: 'aberto' }, { id: 'b', status: 'concluido' }];
  const tarefas = [{ id: 1, projetoId: 'a' }, { id: 2, projetoId: 'b' }, { id: 3, projetoId: null }];
  assert.deepEqual(tarefasAtivas(tarefas, projetos).map((t) => t.id), [1, 3]);
});

test('situação do período do projeto', () => {
  assert.deepEqual(situacaoPeriodo({ inicio: '2026-11-01', prazo: '2026-12-01' }, '2026-11-16'), { tipo: 'andamento', dias: 15, pct: 50 });
  assert.equal(situacaoPeriodo({ inicio: '2026-11-01', prazo: '2026-11-20' }, '2026-11-24').tipo, 'atrasado');
  assert.equal(situacaoPeriodo({ inicio: '2026-11-01', prazo: '2026-11-20' }, '2026-11-24').dias, 4);
  assert.equal(situacaoPeriodo({ inicio: '2026-12-01', prazo: '2026-12-20' }, '2026-11-24').tipo, 'futuro');
});

import fs from 'node:fs';
import { VERSAO } from '../js/config.js';

test('versão do código bate com version.json (senão o aviso de atualização dispara sempre)', () => {
  const publicada = JSON.parse(fs.readFileSync(new URL('../version.json', import.meta.url), 'utf8')).versao;
  assert.equal(publicada, VERSAO);
});

import { completarAno, anoCompleto } from '../js/dominio/datas.js';

test('ano com 2 dígitos vira 20xx; 4 dígitos fica', () => {
  assert.equal(completarAno('0026-11-24'), '2026-11-24');
  assert.equal(completarAno('0005-01-02'), '2005-01-02');
  assert.equal(completarAno('2026-11-24'), '2026-11-24');
  assert.equal(completarAno(''), '');
  assert.ok(anoCompleto('2026-11-24'));
  assert.ok(!anoCompleto('0026-11-24') && !anoCompleto('0202-11-24'));
  assert.ok(!anoCompleto('0020-01-01') && !anoCompleto(''));
});

import { projetoAberto, naLixeira, acoesDeSituacao, podeVerNotificacao, naoLidas } from '../js/dominio/regras.js';

test('situações do projeto e ações possíveis', () => {
  assert.ok(projetoAberto({ status: 'aberto' }) && projetoAberto({ status: 'pausado' }) && projetoAberto({}));
  assert.ok(!projetoAberto({ status: 'concluido' }) && !projetoAberto({ status: 'cancelado' }) && !projetoAberto({ status: 'excluido' }));
  assert.ok(naLixeira({ status: 'excluido' }));
  assert.deepEqual(acoesDeSituacao({ status: 'aberto' }, carla), ['pausar', 'finalizar', 'cancelar', 'excluir']);
  assert.deepEqual(acoesDeSituacao({ status: 'cancelado' }, carla), ['reabrir', 'excluir']);
  assert.deepEqual(acoesDeSituacao({ status: 'excluido' }, carla), []);
  assert.deepEqual(acoesDeSituacao({ status: 'excluido' }, ger), ['restaurar', 'apagar']);
});

test('tarefas de projeto pausado continuam; de cancelado/lixeira somem', () => {
  const projetos = [{ id: 'a', status: 'pausado' }, { id: 'b', status: 'cancelado' }, { id: 'c', status: 'excluido' }];
  const tarefas = [{ id: 1, projetoId: 'a' }, { id: 2, projetoId: 'b' }, { id: 3, projetoId: 'c' }];
  assert.deepEqual(tarefasAtivas(tarefas, projetos).map((t) => t.id), [1]);
});

test('quem vê cada notificação e não lidas', () => {
  const geral = { paraId: null, equipeId: null };
  assert.ok(podeVerNotificacao(carla, geral) && podeVerNotificacao(bruno, geral));
  assert.ok(podeVerNotificacao(carla, { paraId: null, equipeId: 'ana' }) && !podeVerNotificacao(bruno, { paraId: null, equipeId: 'ana' }));
  assert.ok(podeVerNotificacao(ger, { paraId: null, equipeId: 'ana' }));
  assert.ok(podeVerNotificacao(carla, { paraId: 'carla' }) && !podeVerNotificacao(ana, { paraId: 'carla' }));
  const lista = [{ id: 1, em: 100, por: 'ana', paraId: null, equipeId: null }, { id: 2, em: 200, por: 'carla', paraId: null, equipeId: null },
    { id: 3, em: 300, por: 'ana', paraId: null, equipeId: null }];
  assert.equal(naoLidas({ ...carla, notifVistasEm: 150 }, lista, 1000), 1); // a 2 é dela mesma, a 1 já foi vista
});

import { lideresDe, equipesDe, equipesParaCriar, destinoSemLider } from '../js/dominio/regras.js';

test('vários líderes e "sem líder"', () => {
  const multi = { id: 'm', nivel: 'analista', liderIds: ['ana', 'bruno'] };
  const sem = { id: 's', nivel: 'analista', liderIds: [] };
  assert.deepEqual(lideresDe(carla), ['ana']); // campo antigo liderId
  assert.deepEqual(equipesDe(multi), ['ana', 'bruno', 'm']);
  assert.deepEqual(equipesDe(sem), ['s']);
  assert.deepEqual(equipesParaCriar(multi), ['ana', 'bruno']);
  assert.deepEqual(equipesParaCriar(sem), ['s']);
  assert.ok(podeVerTarefa(multi, { equipeId: 'bruno' }) && podeVerTarefa(sem, { equipeId: 's' }));
  assert.ok(!podeVerTarefa(ana, { equipeId: 's' }) && !podeVerTarefa(ana, { equipeId: 'bruno' }));
  const membrosBruno = membrosDaEquipe('bruno', [ana, bruno, carla, multi, sem]).map((u) => u.id);
  assert.deepEqual(membrosBruno, ['bruno', 'm']);
  assert.deepEqual(membrosDaEquipe('s', [ana, sem]).map((u) => u.id), ['s']);
});

test('tarefas "sem líder" vão para o líder do projeto; sem projeto com vários líderes, a gerência escolhe', () => {
  const projetos = [{ id: 'pa', liderId: 'ana' }, { id: 'pz', liderId: 'zeca' }];
  const tarefas = [{ id: 1, equipeId: 's', projetoId: 'pa' }, { id: 2, equipeId: 's', projetoId: null },
    { id: 3, equipeId: 's', projetoId: 'pz' }, { id: 4, equipeId: 'ana', projetoId: null }];
  assert.deepEqual(destinoSemLider('s', ['ana', 'bruno'], tarefas, projetos), { mover: [{ id: 1, equipeId: 'ana' }], escolher: [2, 3] });
  assert.deepEqual(destinoSemLider('s', ['bruno'], tarefas, projetos).mover.map((m) => m.equipeId), ['bruno', 'bruno', 'bruno']);
});
