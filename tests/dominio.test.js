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
