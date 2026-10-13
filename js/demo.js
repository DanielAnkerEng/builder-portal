import { resolveDemo } from './demo-data.mjs';
import { renderDemo } from './demo-renderer.mjs';

const params = new URLSearchParams(window.location.search);
const demo = resolveDemo(params.get('site'));
document.title = `${demo.name} — fiktiv ${demo.label.toLowerCase()}demo | Wreach`;
renderDemo(document.getElementById('demoRoot'), demo);
