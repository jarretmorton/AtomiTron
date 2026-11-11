// Light/dark mode. Follows the system until he picks one, then remembers it.
// The saved choice is applied before first paint by the inline script in
// index.html. This module only handles the toggle.

type Theme = 'light' | 'dark';
const KEY = 'atomitron.theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return systemDark.matches ? 'dark' : 'light';
}

export function initTheme(button: HTMLButtonElement): void {
  const sync = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    button.textContent = next === 'dark' ? '☾' : '☀︎';
    button.setAttribute('aria-label', `Switch to ${next} mode`);
  };
  button.addEventListener('click', () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked (e.g. private browsing): the choice lasts this visit only.
    }
    sync();
  });
  systemDark.addEventListener('change', sync);
  sync();
}
