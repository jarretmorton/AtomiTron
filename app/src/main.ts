import './styles.css';
import './components.css';
import { startRouter } from './router';
import { initTheme } from './theme';

document.getElementById('app-version')!.textContent = `v${__APP_VERSION__}`;
initTheme(document.getElementById('theme-btn') as HTMLButtonElement);
startRouter(document.getElementById('view')!);
