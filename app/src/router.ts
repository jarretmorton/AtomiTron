// Hash routing (#/table, #/combine, #/journal). GitHub Pages has no fallback
// for single-page apps, so path-based routes would 404 on reload.

import { views, type Route } from './views';

const DEFAULT: Route = 'table';

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split('/')[0];
  return name && Object.hasOwn(views, name) ? (name as Route) : DEFAULT;
}

export function startRouter(outlet: HTMLElement): void {
  let first = true;
  const render = () => {
    const route = parse(location.hash);
    outlet.replaceChildren(views[route]());
    for (const tab of document.querySelectorAll<HTMLAnchorElement>('.tab')) {
      if (tab.dataset.route === route) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    // Move focus to the new view for screen readers, except on first load.
    if (!first) outlet.focus({ preventScroll: true });
    first = false;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  render();
}
