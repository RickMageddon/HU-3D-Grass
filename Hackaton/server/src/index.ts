import { createApp } from './app.js';
import { config, llmModel } from './config.js';
import { loadStore } from './minors/store.js';
import { PIPER_VOICE, STT_MODEL, sttInstalled, ttsInstalled } from './speech/paths.js';
import { loadStt } from './speech/stt.js';

const store = loadStore();
createApp(store).listen(config.port, '127.0.0.1', () => {
  console.log(`Server van Minoren in de buurt op http://127.0.0.1:${config.port}`);
  console.log(`  LLM: ${config.provider}${llmModel() ? ` (${llmModel()})` : ' (ingebouwde gespreksleider)'}`);
  console.log(`  Minoren: ${store.info.count} geladen uit ${store.file}`);
  if (!store.info.count) console.log('  ! Nog geen minorgegevens. Zie README → "Minorgegevens importeren".');
  console.log(`  Spraak: herkenning ${sttInstalled() ? `lokaal (${STT_MODEL})` : 'via de browser'}, stem ${ttsInstalled() ? `lokaal (${PIPER_VOICE})` : 'via de browser'}`);
  if (!sttInstalled() || !ttsInstalled()) console.log('  ! Voor lokale spraak (werkt in elke browser): npm run setup:speech');
  // Model alvast laden, zodat de eerste opname niet lang op zich laat wachten.
  if (sttInstalled()) loadStt().then(() => console.log('  Spraakherkenning geladen.'), (e: Error) => console.warn(`  ! Spraakmodel laden mislukt: ${e.message}`));
});
