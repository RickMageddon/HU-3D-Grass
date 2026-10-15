// "Opslaan voor Minoren in de buurt": slaat de pagina die je nu bekijkt op als HTML-bestand.
// Draait alleen als jij erop klikt, op de pagina die je zelf hebt geopend. Er wordt
// niets automatisch opgehaald of doorgeklikt.
(() => {
  if (!/(^|\.)kiesopmaat\.nl$/.test(location.hostname)) {
    alert('Open eerst een pagina van kiesopmaat.nl en klik dan op deze bladwijzer.');
    return;
  }
  if (document.getElementById('anubis_challenge') || /Verifying your browser/i.test(document.title)) {
    alert('De pagina is nog niet geladen (beveiligingscontrole). Wacht tot je de minoren ziet en klik dan opnieuw.');
    return;
  }
  const url = location.href.split('#')[0];
  const html = '<!-- saved from url=(' + String(url.length).padStart(4, '0') + ')' + url + ' -->\n<!-- opgeslagen met de bladwijzer van Minoren in de buurt op ' + new Date().toISOString() + ' -->\n' + document.documentElement.outerHTML;
  const slug = location.pathname.split('/').filter(Boolean).pop() || 'overzicht';
  const qs = location.search ? '-' + location.search.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) : '';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = 'kiesopmaat-' + slug + qs + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  const note = document.createElement('div');
  note.textContent = '✓ Opgeslagen voor Minoren in de buurt: ' + a.download;
  note.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);background:#15803d;color:#fff;padding:10px 16px;border-radius:10px;font:600 15px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25)';
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 2500);
})();
