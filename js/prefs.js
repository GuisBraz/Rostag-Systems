/* Preferências deste aparelho (tema e idioma). Guardadas no navegador. */

const CHAVE = 'rostag-systems-prefs';
const PADRAO = { tema: 'claro', idioma: 'pt' };

function ler() {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return { ...PADRAO }; }
}

let prefs = ler();

export const pref = (k) => prefs[k];

export function definirPref(k, v) {
  prefs = { ...prefs, [k]: v };
  try { localStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch { /* sem storage */ }
  aplicarTema();
}

export function aplicarTema() {
  document.documentElement.dataset.theme = prefs.tema === 'escuro' ? 'dark' : 'light';
  document.documentElement.lang = prefs.idioma === 'en' ? 'en' : 'pt-BR';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = prefs.tema === 'escuro' ? '#0F172E' : '#F7F9FC';
}
