import { DEMOS } from './demo-data.mjs';
import { renderDemo } from './demo-renderer.mjs';

// The response already contains the restaurant. Enhance it with the original menu and dialogs.
renderDemo(document.getElementById('demoRoot'), DEMOS.restaurant);

// Both restaurant previews open in a separate tab from the project dialog.
const footerLink = document.querySelector('.demo-footer a[href="index.html#nettsider"]');
if (footerLink) {
  const back = document.createElement('button');
  back.type = 'button';
  back.className = footerLink.className;
  back.dataset.journeyReturn = '';
  back.textContent = 'Tilbake til Kundereisen';
  footerLink.replaceWith(back);
}
for (const back of document.querySelectorAll('[data-journey-return]')) {
  back.addEventListener('click', () => {
    document.getElementById('returnHelp').textContent = 'Gå tilbake til Wreach-fanen med Kundereisen.';
    window.close();
  });
}
