/* Datas, saudação e semana do ano — funções puras (testáveis no Node). */

export function saudacao(data = new Date()) {
  const h = data.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Semana ISO 8601 (segunda a domingo; semana 1 contém a primeira quinta do ano). */
export function semanaISO(data = new Date()) {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7;          // domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);  // quinta-feira da mesma semana
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - inicioAno) / 86400000 + 1) / 7);
}

const p2 = (n) => String(n).padStart(2, '0');

/** 24/11/26 – 19:47 */
export function dataHoraCurta(data = new Date()) {
  return `${p2(data.getDate())}/${p2(data.getMonth() + 1)}/${String(data.getFullYear()).slice(-2)} – ${p2(data.getHours())}:${p2(data.getMinutes())}`;
}

/** 'AAAA-MM-DD' no fuso local. */
export function hojeISO(data = new Date()) {
  return `${data.getFullYear()}-${p2(data.getMonth() + 1)}-${p2(data.getDate())}`;
}

/** 'AAAA-MM-DD' -> '24/11/26' */
export function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(-2)}`;
}

/** timestamp (ms) -> '24/11/26 19:47' */
export function fmtDataHora(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Segunda e domingo (ISO 'AAAA-MM-DD') da semana da data. */
export function limitesSemana(data = new Date()) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const dia = d.getDay() || 7;
  const seg = new Date(d); seg.setDate(d.getDate() - dia + 1);
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
  return { inicio: hojeISO(seg), fim: hojeISO(dom) };
}
