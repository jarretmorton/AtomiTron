// Hash routing (#/table, #/element/Na, #/combine, #/journal). GitHub Pages has
// no fallback for single-page apps, so path-based routes would 404 on reload.

import { views, type Route } from './views';

const DEFAULT: Route = 'table';
/** Which tab is highlighted for each route. */
const TAB: Record<Route, string> = { table: 'table', element: 'table', combine: 'combine', journal: 'journal' };

function parse(hash: string): { route: Route; params: string[] } {
  const [name, ...params] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const route = name && Object.hasOwn(views, name) ? (name as Route) : DEFAULT;
  return { route, params };
}

export function startRouter(outlet: HTMLElement): void {
  let first = true;
  const render = () => {
    const { route, params } = parse(location.hash);
    document.title = 'AtomiTron — explore the elements';
    outlet.replaceChildren(views[route](params));
    for (const tab of document.querySelectorAll<HTMLAnchorElement>('.tab')) {
      if (tab.dataset.route === TAB[route]) tab.setAttribute('aria-current', 'page');
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
