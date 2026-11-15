// Light/dark mode with three settings: System (follow the iPad), Light, Dark.
// The button shows the current setting and steps to the next one. A saved
// Light or Dark choice is applied before first paint by the inline script in
// index.html; System is the default and stores nothing.

export type ThemeSetting = 'system' | 'light' | 'dark';
const KEY = 'atomitron.theme';
const ORDER: ThemeSetting[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeSetting, { icon: string; name: string }> = {
  system: { icon: '◐', name: 'System' },
  light: { icon: '☀︎', name: 'Light' },
  dark: { icon: '☾', name: 'Dark' },
};

/** The setting after this one: System, Light, Dark, then round again. */
export function nextSetting(s: ThemeSetting): ThemeSetting {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]!;
}

function current(): ThemeSetting {
  const set = document.documentElement.dataset.theme;
  return set === 'light' || set === 'dark' ? set : 'system';
}

function apply(s: ThemeSetting): void {
  if (s === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s;
  try {
    if (s === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch {
    // Storage blocked (e.g. private browsing): the choice lasts this visit only.
  }
}

export function initTheme(button: HTMLButtonElement): void {
  const sync = () => {
    const s = current();
    const { icon, name } = LABEL[s];
    button.textContent = `${icon} ${name}`;
    button.setAttribute('aria-label', `Color mode: ${name}. Switch to ${LABEL[nextSetting(s)].name}.`);
  };
  button.addEventListener('click', () => {
    apply(nextSetting(current()));
    sync();
  });
  sync();
}
