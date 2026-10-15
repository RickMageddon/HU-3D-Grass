# Minoren in de buurt: Nederlandse spraakassistent voor minoren

*Minoren in de buurt* is een webapplicatie waarmee hbo-studenten in een **Nederlands spraakgesprek** met een AI-assistent ontdekken welke minoren bij hen passen. De minorgegevens komen van [Kies op Maat](https://www.kiesopmaat.nl/modules/). De app rangschikt **alle** relevante minoren van beste naar minder goede match. Per minor zie je een uitleg, een **matchscore** en een **informatiezekerheid**, en je kunt minoren vergelijken.

- **Frontend:** React 19 + TypeScript + Vite (`client/`)
- **Backend:** Node.js + Express + TypeScript (`server/`): gespreksleider, LLM-koppeling, minordata en scoreberekening
- **Gedeelde types:** `shared/types.ts`

---

## Inhoud

1. [Snel starten](#snel-starten)
2. [Configuratie (LLM en API-sleutels)](#configuratie)
3. [Minorgegevens importeren](#minorgegevens-importeren)
4. [Zo werkt het](#zo-werkt-het)
5. [Matchscore en informatiezekerheid](#scores)
6. [Privacy en transparantie](#privacy)
7. [Testen](#testen)
8. [Wat werkt en wat zijn de beperkingen](#status)

---

## Snel starten

Vereist: **Node.js 20+** (getest met 22) en npm. Voor spraak heb je twee mogelijkheden:

- **Lokale spraak (aanbevolen, werkt in elke browser, ook Chromium en Firefox):** `npm run setup:speech` installeert eenmalig Whisper (herkenning) en Piper (Nederlandse stem), zo'n 350 MB. Audio blijft op je eigen computer.
- **Zonder setup:** de ingebouwde spraak van de browser. Die werkt alleen goed in **Google Chrome, Edge of Safari**. Chromium (bijvoorbeeld de Ubuntu-snap) en Firefox hebben geen werkende spraakherkenning, en de Chromium-snap ziet geen stemmen.

```bash
cd Hackaton
npm install                    # installeert client + server (npm workspaces)
cp server/.env.example server/.env   # optioneel: LLM instellen, zie hieronder
npm run setup:speech           # optioneel maar aanbevolen: lokale Nederlandse spraak (Linux x64)
npm run import -- ~/Downloads  # leest opgeslagen Kies op Maat-pagina's in (zie hieronder)
npm run dev                    # backend op :8787, frontend op http://localhost:5173
```

Open <http://localhost:5173> en klik op **Start spraakgesprek**. De browser vraagt toestemming voor de microfoon.

> Spraakherkenning werkt alleen op `localhost` of via **https**, niet via een kaal IP-adres op http.

**Productie** (één proces dat ook de gebouwde frontend serveert):

```bash
npm run build
npm start                      # http://127.0.0.1:8787
```

De server luistert bewust alleen op `127.0.0.1`. Zet er voor gebruik op een netwerk een reverse proxy met https voor, bijvoorbeeld Caddy of nginx.

**Uitproberen zonder echte data:** `npm run dev:testdata` start de app met een kleine **fictieve** testdataset (minoren met `[TEST]` in de naam en "Testhogeschool" als instelling). Die is alleen bedoeld om de app en de tests te laten werken, niet als echte informatie.

---

## Configuratie

Alle instellingen staan in `server/.env` (voorbeeld: `server/.env.example`). **API-sleutels staan alleen op de server**: de frontend praat uitsluitend met de eigen backend (`/api/...`) en krijgt nooit een sleutel te zien. `.env` staat in `.gitignore`.

| Variabele | Betekenis |
|---|---|
| `LLM_PROVIDER` | `auto` (standaard), `anthropic`, `openai` of `none` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude via de Anthropic API (standaard `claude-opus-5-5`) |
| `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY` | Elke OpenAI-compatibele server, bijv. **Ollama** (gratis, lokaal, open source), LM Studio of Groq |
| `LLM_TIMEOUT_MS` | Time-out per LLM-aanroep (standaard 20000) |
| `PORT`, `MINORS_FILE` | Poort van de backend en pad naar de dataset |
| `LOCAL_SPEECH` | `auto` (lokale spraak gebruiken als die geïnstalleerd is) of `off` (altijd de browser) |
| `STT_MODEL` | Whisper-model, standaard `onnx-community/whisper-small` (sneller: `whisper-base`) |
| `PIPER_VOICE`, `PIPER_SPEED` | Nederlandse stem (standaard `nl_NL-pim-medium`; ook `nl_NL-ronnie-medium`, `nl_BE-nathalie-medium`, …) en spreektempo |

Drie manieren om het gesprek te laten lopen:

1. **Zonder LLM (`none`, standaard als er niets is ingesteld):** een ingebouwde, regelgebaseerde Nederlandse gespreksleider. Gratis, offline en voorspelbaar. Hij vraagt door bij twijfel of vage antwoorden, haalt terloopse informatie uit antwoorden, herhaalt geen beantwoorde vragen en begrijpt opdrachten als "sla over", "herhaal", "toon de resultaten" en "begin opnieuw".
2. **Gratis met Ollama:** `ollama pull llama3.1 && ollama serve`, en daarna in `.env`: `OPENAI_BASE_URL=http://localhost:11434/v1` en `OPENAI_MODEL=llama3.1`.
3. **Claude:** zet `ANTHROPIC_API_KEY`. De app gebruikt gestructureerde output (JSON-schema) met lage effort voor snelle antwoorden.

Faalt de LLM (time-out, fout of ongeldig antwoord), dan valt de server per beurt automatisch terug op de ingebouwde gespreksleider en meldt dat in de interface. In alle drie de gevallen **beveelt de LLM zelf geen minoren aan**: dat doet de deterministische scoremodule op basis van de geïmporteerde gegevens.

---

## Minorgegevens importeren

### Waarom handmatig?

`kiesopmaat.nl` heeft geen open API. De site is beveiligd met **Anubis**, een proof-of-work-controle die de beheerder volgens de eigen uitleg inzet *"to protect the server against the scourge of AI companies aggressively scraping websites"*. `robots.txt` staat alles toe, maar de bedoeling van de beheerder is duidelijk. Daarom **omzeilt deze app die beveiliging niet en haalt ze zelf niets automatisch op**. In plaats daarvan bekijkt een mens de pagina's in de eigen browser en slaat ze op; de app leest die bestanden lokaal in.

Voor structureel gebruik, bijvoorbeeld door een hogeschool, is het netjes om **Kies op Maat / SURF om toestemming of een data-export te vragen**. De importer is zo gebouwd dat een andere bron later eenvoudig kan worden toegevoegd.

### Stappen (met de bladwijzerknop, makkelijkst)

1. Start de app en open <http://localhost:5173/opslaan.html>. Sleep de knop **"Opslaan voor Minoren in de buurt"** naar je bladwijzerbalk.
2. Open <https://www.kiesopmaat.nl/modules/> en wacht tot je de minoren ziet. Klik op de bladwijzer: er verschijnt een groene melding en er komt een bestand in *Downloads*. De bladwijzer slaat de pagina op zoals jij hem ziet, inclusief inhoud die via JavaScript geladen is, met de bron-URL erbij.
3. Open de **eigen pagina van elke minor** die je volledig wilt hebben en klik daar ook op de bladwijzer. Minoren die alleen in het overzicht staan, worden wel getoond, maar met een lagere informatiezekerheid.
4. Draai:

   ```bash
   npm run import -- ~/Downloads
   ```

   Alleen bestanden van kiesopmaat.nl worden gelezen. Je kunt ook gewoon **Ctrl+S** gebruiken en de bestanden in `server/data/raw/` zetten; dan is `npm run import` genoeg.

   De importer meldt per bestand wat er is herkend en welke velden ontbreken. Een per ongeluk opgeslagen beveiligingspagina wordt herkend en overgeslagen. Het resultaat komt in `server/data/minors.json`, met per minor het bronbestand en de ophaaldatum (de opslagdatum van het bestand).
5. Herstart de server (`npm run dev`).

De importer werkt **heuristisch** op koppen en labels zoals "Toelatingseisen", "Voertaal", "Studiepunten" en "Periode", niet op vaste CSS-klassen. Hij **vult niets aan en verzint niets**: wat niet gevonden wordt, blijft leeg en verschijnt in de app als *onbekend*. `minors.json` staat in `.gitignore`, zodat de inhoud van Kies op Maat niet via git wordt herverspreid.

De importer heeft een **specifieke extractor voor de detailpagina's van Kies op Maat**, afgestemd op echte, door een gebruiker opgeslagen pagina's (oktober 2026): `section#main` met de beschrijving en de secties Leerdoelen, Ingangseisen, Rooster en Toetsing, plus `section.detail` met instelling, plaats, onderwijsperiodes, EC, voertaal en type. Modules die geen minor zijn (bijvoorbeeld type "Vak") worden overgeslagen. "Aanmelding gesloten" wordt per periode overgenomen. De **naam van de docent wordt bewust niet opgeslagen**. Voor andere opbouw (zoals overzichtspagina's) is er een heuristische terugval. Verandert de site later, controleer dan de meldingen van `npm run import`.

---

## Zo werkt het

```
Browser (React)                               Server (Express)
─────────────────────────────                 ─────────────────────────────────────
Microfoon → Web Speech API (nl-NL)  ── tekst ─▶ POST /api/chat
                                                  ├─ LLM (Claude / Ollama), óf
                                                  └─ ingebouwde gespreksleider
Tekst ◀── antwoord + profiel ─────────────────────┘
speechSynthesis (Nederlandse stem)
                                     ── profiel ─▶ POST /api/recommend
Ranglijst, filters, vergelijken ◀── resultaten ── scoremodule ← data/minors.json
```

- **Spraak is de standaard.** Na elke vraag luistert de app automatisch (uit te zetten). De **microfoonknop** toont de status: luisteren, nadenken of praten. Tijdens het luisteren is er een **opname-indicator** met live tekst.
- **Onderbreken:** druk tijdens het praten van de assistent op de microfoon, druk op **Esc** of begin te typen. "Begin opnieuw" (gesproken of via de knop) start het gesprek opnieuw.
- **Alles wat gezegd wordt, staat ook als tekst** in het gesprek. Een schermlezer leest het nieuwste antwoord voor.
- **Tekstinvoer** is er altijd. Werkt spraak niet (geen ondersteuning, microfoon geweigerd, geen Nederlandse stem, geen internet), dan toont de app een duidelijke foutmelding en gaat het gesprek via tekst verder.
- Het gesprek gaat over zes onderwerpen: hobby's en interesses, huidige en eerdere opleidingen, vakken, werkervaring en vaardigheden, ambities, en wat de student wil ontdekken (en juist niet). Er komt **steeds één vraag tegelijk**.

---

<a id="scores"></a>
## Matchscore en informatiezekerheid

Beide scores worden **deterministisch in de backend** berekend (`server/src/match/score.ts`), dus niet door een LLM, en zijn per minor in de app uitgesplitst. Klik op *"Toelatingseisen en scoreberekening"* of op *"Hoe werken de scores?"*.

### Matchscore (0–100)

1. Per onderwerp worden de woorden van de student genormaliseerd: kleine letters, stopwoorden eruit, licht gestemd. Daarnaast worden **thema's** herkend via een kleine, controleerbare thesaurus (`server/src/match/text.ts`), zodat bijvoorbeeld *programmeren* ook *software* en *ICT* vindt.
2. Per minor wordt gezocht in de **titel** (gewicht 3) en de **beschrijving** (gewicht 1). Een thema-treffer telt 0,8×. Zeldzame woorden tellen zwaarder (IDF-gewicht 0,3–1).
3. Per onderwerp: `score = 1 − e^(−punten / 2,5)`. Een paar sterke treffers tellen veel, nog meer treffers voegen steeds minder toe.
4. De matchscore is het **gewogen gemiddelde** over de beantwoorde onderwerpen: *wat je wilt ontdekken* 26%, *interesses* 22%, *ambities* 22%, *vakken* 12%, *opleiding* 10%, *werkervaring* 8%.
5. Woorden die de student wil vermijden ("niets met marketing") tellen nooit positief. Bevat een minor zo'n onderwerp, dan wordt de score **gehalveerd**, met een melding.
6. **Relevant** = matchscore ≥ 25 én een overeenkomst met meer dan alleen de opleiding. Er is **geen maximum aantal**: alle relevante minoren worden getoond, en met één klik ook de minder passende.

### Informatiezekerheid (0–100)

Punten voor: uitgebreide beschrijving (20), toelatingseisen (15), onderwijsinstelling (10), studiepunten (5), voertaal (5), periode of locatie (5), eigen minorpagina in plaats van alleen het overzicht (10), actualiteit (10: ≤ 60 dagen; 5: ≤ 180 dagen) en de volledigheid van het studentprofiel (20).

### Doorverwijzing naar een studieadviseur

De app raadt een studieadviseur aan als er geen data is, als het profiel voor minder dan 50% is ingevuld, als er geen relevante minor is, als de student over twee of meer onderwerpen twijfelde, of als de beste match een matchscore onder 40 of een zekerheid onder 50 heeft.

---

## Lokale spraak (Whisper + Piper)

`npm run setup:speech` downloadt de [Piper](https://github.com/rhasspy/piper)-binary (MIT), een Nederlandse Piper-stem (van [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)) en een Whisper-model (via [transformers.js](https://github.com/huggingface/transformers.js), draait op de CPU) naar `server/speech/` (staat in `.gitignore`). Daarna gebruikt de app automatisch:

- **Herkenning:** de browser neemt op met de microfoon, merkt zelf op wanneer je stopt met praten (1,3 s stilte) en stuurt de opname als WAV naar `/api/stt`. Whisper zet die om naar tekst. Op een gewone laptop-CPU kost dat 2–4 s per antwoord.
- **Stem:** `/api/tts` laat Piper de tekst uitspreken; de volgende zin wordt al gemaakt terwijl de vorige speelt.
- Audio wordt alleen in het geheugen verwerkt en **niet opgeslagen of gelogd**. Bekende Whisper-"hallucinaties" bij stilte (zoals "Ondertiteling door…") worden weggefilterd.

Is lokale spraak niet geïnstalleerd, dan valt de app terug op de spraak van de browser.

<a id="privacy"></a>
## Privacy en transparantie

- De openingszin en het startscherm vertellen dat de student met een **AI** praat.
- **Niets wordt permanent opgeslagen.** Het gesprek leeft alleen in het geheugen van het browsertabblad: geen `localStorage`, geen cookies, geen database. De server is stateless, logt geen gespreksinhoud en stuurt `Cache-Control: no-store` mee.
- Er wordt alleen gevraagd naar wat nodig is voor de match. Naam, e-mail of studentnummer zijn niet nodig.
- **Spraak:** met lokale spraak blijft de audio op je eigen server. Zonder lokale spraak stuurt de spraakherkenning van Chrome en Edge de audio naar Google of Microsoft; dat meldt de app op het startscherm. Met een LLM ingesteld gaat de tekst van het gesprek naar die aanbieder; met Ollama blijft alles lokaal.
- Sleutels staan alleen in `server/.env`. Invoer wordt server-side gevalideerd (zod, maximale lengtes), en er is een eenvoudige rate limit per IP tegen misbruik van de LLM-sleutel.

---

## Testen

```bash
npm test          # unit- en scenariotests van server (40, incl. Piper→Whisper als spraak geïnstalleerd is) en client (3)
npm run typecheck
npm run build

# End-to-end in een echte Chromium (app moet draaien met de testdata):
npm run dev:testdata               # in een tweede terminal
CHROME_PATH=/pad/naar/chrome npm run e2e
```

Gedekte scenario's (`server/test/scenarios.test.ts`, `client/src/speech.test.tsx`, `e2e/`):

| Scenario | Wat wordt getoetst |
|---|---|
| **1. Twijfelende student** | Bij "weet ik niet" komt één hulpvraag met voorbeelden, daarna gaat het gesprek verder. Twijfel mét inhoud ("tussen zorg en techniek") wordt wél gebruikt. Hoogstens één vraag per beurt. De student wordt doorverwezen naar een studieadviseur. |
| **2. Ontbrekende informatie** | Doorvragen bij antwoorden van één woord; vroegtijdig "toon de resultaten"; lage profielvolledigheid en lagere informatiezekerheid; *toelatingseisen ontbreken* wordt gemeld; overgeslagen vragen komen niet terug. |
| **3. Meerdere passende minoren** | Alle onderwerpen zonder herhaling; meerdere relevante minoren, correct gerangschikt; uitleg per minor; de uitsplitsing telt op tot de matchscore; afgewezen onderwerpen tellen niet mee; detaildata geeft hogere zekerheid. |
| **4. Niet-werkende spraak** | Browser zonder `SpeechRecognition` (waarschuwing, geen microfoonknop, gesprek via tekst); geweigerde microfoon (duidelijke foutmelding, automatisch luisteren gaat uit, tekst werkt). In echte headless Chromium is de foutmelding *"geen toegang tot de microfoon"* bevestigd. |
| Spraakflow (e2e) | Met gesimuleerde spraak-API's: voorlezen → automatisch luisteren → herkende tekst versturen → onderbreken met de microfoon → "begin opnieuw" per spraak. |
| Overig | Importer (koppen, `dl`, `strong`-labels, samenvoegen overzicht + detail, Anubis-pagina, andere domeinen), API-validatie, terugval bij een niet-bereikbare LLM, verwerking van een OpenAI-compatibel LLM-antwoord, lege dataset. |

---

<a id="status"></a>
## Wat werkt en wat zijn de beperkingen

**Werkt en is getest**

- Volledige Nederlandse spraakflow in de browser (herkenning `nl-NL`, voorlezen met een Nederlandse stem, opname-indicator, onderbreken, opnieuw beginnen, automatisch luisteren), met tekst als volwaardig alternatief.
- Ingebouwde gespreksleider zonder externe diensten; optionele LLM via Anthropic of een OpenAI-compatibele server, met automatische terugval.
- Import van opgeslagen Kies op Maat-pagina's, aanbevelingen zonder maximum, matchscore en informatiezekerheid met volledige uitsplitsing, filters (zoeken, instelling, voertaal, minimale scores, sorteren, minder passende tonen), vergelijken van 2–4 minoren, uitlegpagina, verwijzing naar een studieadviseur.
- Responsief ontwerp (getest op 390 px en 1280 px breed), donkere modus, toetsenbordbediening, ARIA-labels en ondersteuning voor `prefers-reduced-motion`.

**Beperkingen (eerlijk)**

- **Er zit geen echte minordata in de repository.** Je moet de pagina's zelf opslaan en importeren (zie hierboven). Zonder data toont de app geen aanbevelingen, maar een melding plus verwijzing naar een studieadviseur. De detailextractor is afgestemd op 8 echte pagina's. De overzichtspagina van Kies op Maat is nog niet met een echt bestand getest; daarvoor geldt de heuristische terugval.
- De app kan alleen minoren aanbevelen die je hebt opgeslagen. Met een handvol pagina's is de ranglijst dus ook maar een handvol minoren lang.
- **Lokale spraak is getest in echte Chromium met een nep-microfoon** die een door Piper uitgesproken Nederlandse zin afspeelt; die werd exact herkend. Met een echte microfoon en echte stemmen is het niet automatisch getest. Herkenning duurt 2–4 s per antwoord (geen live meelezende tekst zoals bij Chrome), en de automatische installatie werkt alleen op Linux x64.
- De browserspraak (zonder setup) is getest met gesimuleerde spraak-API's; de foutafhandeling van de echte Chromium-API is bevestigd.
- Onderbreken gaat via de microfoonknop, Esc of typen. **Door de assistent heen praten wordt niet herkend**: de microfoon staat uit terwijl de assistent praat, om te voorkomen dat hij zichzelf hoort.
- Zonder lokale spraak werkt herkenning niet in Firefox en Chromium, en vereist ze in Chrome en Edge internet (cloudspraakdienst). Of er dan een Nederlandse stem is, hangt af van browser en besturingssysteem.
- **De LLM-koppelingen zijn niet live getest**, omdat er geen API-sleutel en geen Ollama-installatie beschikbaar was. Het Anthropic-pad is gecontroleerd met de TypeScript-typen van de SDK, het OpenAI-compatibele pad met een nepserver.
- De matching vergelijkt woorden en thema's. Ze begrijpt geen context ("geen zorg" wordt alleen goed opgepikt als het als afwijzing wordt herkend) en de thesaurus is bewust klein. Toelatingseisen worden getoond en gemarkeerd, maar **niet automatisch gecontroleerd** tegen de opleiding van de student.
- De ingebouwde gespreksleider werkt met patronen. Ongebruikelijke formuleringen begrijpt hij soms niet, en dan vraagt hij door of gaat hij verder.
- De rate limit staat in het geheugen van één proces en is bedoeld voor demo- en kleinschalig gebruik.

---

## Projectstructuur

```
Hackaton/
├── client/                 React + Vite frontend (public/opslaan.html = bladwijzerknop)
│   └── src/
│       ├── components/     StartScreen, ConversationScreen, MicButton, Transcript, TopicProgress,
│       │                   ResultsScreen, MinorCard, ScoreMeter, CompareView, MethodDialog, …
│       ├── hooks/          useSpeechRecognition/-Synthesis (browser), useLocalRecognition/-Synthesis (server)
│       └── lib/api.ts
├── server/
│   ├── src/
│   │   ├── chat/           ruleAgent (ingebouwd), llmAgent (Anthropic / OpenAI-compatibel), topics
│   │   ├── match/          text (tokenizer, thesaurus), score (matchscore, zekerheid)
│   │   ├── importer/       parse + cli (opgeslagen Kies op Maat-pagina's → minors.json)
│   │   ├── speech/         stt (Whisper), tts (Piper), wav
│   │   └── minors/store.ts
│   ├── scripts/            setup-speech.ts
│   ├── speech/             lokale spraakmodellen (na npm run setup:speech, niet in git)
│   ├── data/raw/           ← hier opgeslagen .html-bestanden neerzetten
│   └── test/               vitest + fictieve testpagina's
├── shared/types.ts
└── e2e/                    browsertests (playwright-core + eigen Chrome/Chromium)
```
