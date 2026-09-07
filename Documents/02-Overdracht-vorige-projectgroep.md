# Overdracht vorige projectgroep — Printfarm Manager

**Bron:** documentatie projectgroep Atum3D Printfarm, studiejaar 2025–2026
**Teamleden vorige groep:** Nick van Slooten, Hamsa Abou Ammar, Martijn Gorissen
**Opgeleverd:** januari 2026
**Samengevat op:** 7 september 2026

> Dit document vat samen wat de vorige projectgroep heeft gebouwd, welke keuzes zij hebben
> gemaakt en waar zij zijn vastgelopen. Doel is dat wij niet opnieuw hoeven uit te zoeken wat
> zij al hebben uitgezocht. De originele documenten staan in
> [../Provided-Files/Printfarm_project_definitief/Definitief/](../Provided-Files/Printfarm_project_definitief/Definitief/).

---

## 1. Wat er is opgeleverd

Een Proof of Concept voor een **printfarm manager**: een centraal webdashboard waarmee
meerdere Atum3D resinprinters gemonitord en beheerd kunnen worden, met automatische meting
van het resinniveau via een capacitieve sensor.

Het probleem dat zij oplosten: operators moesten handmatig controleren of er genoeg resin in
de tray zat, of het bouwplatform vrij was en wat de printerstatus was. Printstatus was
uitsluitend zichtbaar op het lokale scherm bij de printer. Daardoor konden prints starten
zonder voldoende materiaal en werd een vastgelopen print niet direct opgemerkt.

## 2. Architectuur

Het systeem bestaat uit drie lagen, bewust gescheiden gehouden zodat het uitbreidbaar blijft:

| Laag | Functie | Technologie |
| --- | --- | --- |
| Meetlaag (embedded) | Meet het resinniveau capacitief | FDC1004-sensor + STM32 Nucleo-F767ZI, Mbed OS, C++ |
| Serverlaag (backend) | Verzamelt meetdata, beheert printers, jobs en gebruikers | Node.js, Express, SQLite, JWT |
| Presentatielaag (frontend) | Dashboard voor monitoring en bediening | React |

De STM32 leest de sensor uit via I²C en stuurt de meetwaarde als TCP-client naar een centrale
Raspberry Pi, waarop de backend draait. Communicatie tussen frontend en backend loopt hybride:
REST voor gestructureerde data (logs, printers, jobs) en WebSockets voor realtime updates
(printerstatus, resinniveau). Die hybride keuze is bewust gemaakt omdat het bestaande systeem
van Atum3D zelf ook WebSockets gebruikt.

De architectuur is gedocumenteerd volgens het **C4-model** (context, container, component).
De vorige groep noemt dit expliciet als een succesvolle keuze: het begint globaal en zoomt
stapsgewijs in, waardoor zowel de opdrachtgever als de projectleiding het goed kon volgen.
Overweeg dit model over te nemen.

### Berichtformaat sensor naar server

Eén regel tekst per meting, afgesloten met een newline:

```
IP=192.168.2.101;C=12.3456
```

`IP` is het statische adres van het STM32-bord (om de meting aan de juiste printer te
koppelen), `C` de gemeten capaciteit in picofarad. Bewust een leesbaar tekstformaat gekozen:
makkelijk te debuggen in seriële output en triviaal te parsen aan de serverkant.

## 3. Hardware

De sensoropstelling per printer bestaat uit:

- 1x STM32 Nucleo-F767ZI
- 1x FDC1004 capacitieve sensor (Texas Instruments)
- 1x 0.1 µF en 1x 1 µF keramische condensator (ruisonderdrukking)
- 2x 4.7 kΩ weerstand (pull-ups op de I²C-bus)
- 1x SMD-naar-DIP converter (10 pins) + 10x header pins
- 1x koperen plaat als elektrode (3 mm dik, 10 mm breed, 45 mm lang)
- 1x 3D-geprinte elektrodehouder (ontworpen in Autodesk Inventor)
- 1x coaxkabel RG-174 (afgeschermd), M2.5 schroef en moer, jumper cables, UTP-kabel

Voor het hele systeem is één Raspberry Pi nodig.

## 4. Onderzoeksresultaten — dit hoef je niet opnieuw te doen

De vorige groep heeft drie meetprincipes onderzocht voor het meten van resinniveau. Hun
conclusies, inclusief de redenen waarom opties afvielen:

**Gewichtsmeting — afgevallen.** Theoretisch nauwkeurig, maar de sensor zou onder de resintray
moeten. De tray zit direct aan het stijve printerframe dat nauwkeurig is uitgelijnd met de
Z-as. Een sensor daartussen beïnvloedt die uitlijning en kan vervorming veroorzaken tijdens
het printen. Vergt een ingrijpende verbouwing van de printer.

**Time-of-Flight lichtsensor — afgevallen.** Er is nauwelijks ruimte om de sensor te
plaatsen (niet boven het aflopende deel van de tray, want dan meet je niets zodra het niveau
onder de knik zakt). Bovendien zijn sommige resins deels transparant, waardoor de lichtpuls
niet betrouwbaar reflecteert — de meting werkt dan bij de ene resin wel en bij de andere niet.
Harsspatten op de lens verstoren de meting verder.

**Capacitieve sensor (FDC1004) — gekozen.** Werkt ongeacht kleur of transparantie van de
resin, omdat het meet op diëlektrische eigenschappen in plaats van optische reflectie.

Belangrijke randvoorwaarden bij de capacitieve oplossing:

- De sensor kan **niet** aan de buitenzijde van de tray: die is van aluminium (type 6060),
  elektrisch geleidend, en blokkeert het veld. De elektrodes moeten aan de **binnenzijde**,
  in direct contact met de resin.
- **Elk resintype moet apart gekalibreerd worden**, omdat de capaciteit per soort verschilt.
- Bedrading en elektronica moeten afgeschermd zijn tegen harslekkage; mogelijk is een coating
  op de elektrode nodig ter bescherming.
- Rondom het bouwplatform zit slechts enkele millimeters ruimte tot de binnenwand van de tray.
  Grote sensoren passen daar niet.

## 5. Valkuilen en geleerde lessen

Dit is het waardevolste deel van de overdracht — hier is bij de vorige groep de meeste tijd
verloren gegaan.

### TCP/IP op de STM32: gebruik Mbed OS, niet STM32CubeIDE

De vorige groep heeft veel tijd verloren aan het opzetten van een TCP/IP-socketverbinding
tussen de STM32 en de Raspberry Pi met STM32CubeIDE (en later Arduino). Het uitlezen van de
sensor werkte prima in beide omgevingen, maar de TCP-verbinding was onbetrouwbaar: soms kwam
er geen verbinding tot stand, soms viel die weg na twee berichten. In debug-modus werkte
alles perfect, wat het debuggen bijzonder lastig maakte.

De oplossing was overstappen op **Mbed OS**, dat een hogere abstractielaag biedt voor
netwerkcommunicatie (`EthernetInterface`, `TCPSocket`, `NetworkInterface`). Het programma
werkte daarna in één keer. Als je met deze hardware netwerkcommunicatie moet opzetten:
begin bij Mbed OS.

### Afgeschermde kabel is noodzakelijk voor stabiele metingen

Bij het testen met resin bleken kleine veranderingen in de opstelling en omgeving grote
verschillen in de gemeten capaciteit te veroorzaken. Het gebruik van een **afgeschermde kabel
(coax RG-174) tussen de sensormodule en de elektrode** heeft dit sterk verminderd. De
shield-pin van de FDC1004 en de shieldkabel zorgen voor actieve afscherming; deze zijn
onderling niet verbonden.

### Verwachtingsmanagement met de opdrachtgever

De groep kreeg scherpe, negatieve feedback van de opdrachtgever op hun Plan van Aanpak,
terwijl zowel de projectbegeleider als Campus Gouda datzelfde document goed vond. Dat kwam
hard aan en drukte tijdelijk de motivatie. Na overleg met docenten hebben zij het document
aangepast en opnieuw voorgelegd; toen was het wel akkoord, en volgende overleggen verliepen
prettiger.

Hun advies, letterlijk uit het reflectieverslag: **laat het bedrijf documenten eerst lezen
voordat je ze formeel presenteert.** Dan kom je niet voor verrassingen te staan in een
vergadering. Aanvullend: houd wekelijks contact in plaats van alleen op mijlpalen — dat
verminderde bij hen de miscommunicatie merkbaar.

### Figma-prototypes werkten goed richting de opdrachtgever

De frontend is eerst in Figma ontworpen, met interacties erin verwerkt zodat er een
functionele klikbare demo ontstond die online gedeeld kon worden. De opdrachtgever reageerde
positief en er waren daardoor slechts minimale aanpassingen nodig. Een goedkope manier om
vroeg feedback op te halen.

## 6. Wat wel en niet gevalideerd is

Van de acht Must-have-eisen is het overgrote deel behaald: resinmeting, statusweergave,
automatische startcontrole, centraal dashboard, foutmeldingen en notificaties, rollen
(admin/gebruiker) en realtime updates. Ook de Should-haves (authenticatie, logging,
schaalbaarheid) zijn gehaald.

**Eén harde eis is niet volledig gevalideerd:** het daadwerkelijk versturen en uitvoeren van
printjobs op fysieke printers (eis M5). Door een verbouwing bij Atum3D waren echte printers
tijdens de eindfase niet beschikbaar. Atum3D leverde een simulatiescript dat als nepprinter
fungeerde; volgens de opdrachtgever komt dit functioneel één-op-één overeen met echte
printercommunicatie. Bij de resintests is een plastic bakje gebruikt in plaats van een echte
resintray.

De logica is dus geïmplementeerd en getest tegen de simulatie, maar **praktijkvalidatie op
echte printers ontbreekt**. Dit is expliciet vastgelegd in hun testrapport en is een direct
aandachtspunt voor ons project — zeker omdat de opdrachtgever nu juist vraagt om iets dat
werkt met echte printende printers.

## 7. Aanbevelingen van de vorige groep voor vervolg

- **Ontwerp een PCB voor de sensormodule.** De huidige opstelling zit gesoldeerd op een
  printplaatje met headers, geprikt op een breadboard samen met de losse condensatoren en
  weerstanden. Prima voor een PoC, niet geschikt voor echt gebruik. Het advies is een
  printplaat te ontwerpen die direct als shield op de STM32 Nucleo-F767ZI past. Dit sluit
  aan bij KiCad in de toolinglijst van Atum3D.
- **Verdere hardware-integratie, kalibratie en verfijning** zijn nodig voordat het systeem
  productieklaar is.
- **Valideer op echte printers.**

## 8. Broncode

De repositories van de vorige groep:

- Sensorfirmware (Mbed OS, inclusief 3D-bestanden voor de elektrodehouder):
  `github.com/MartijnGorissen/NUCLEO-F767ZI-FDC1004-socket-MBed`
- Backend: `github.com/NickvanSlooten/atum3dprintfarm-backend`
- Frontend: `github.com/NickvanSlooten/atum3dprintfarm-frontend`

Controleer bij het startoverleg of we toegang houden tot deze repositories en of Atum3D een
eigen kopie heeft — persoonlijke studentaccounts zijn geen duurzame plek voor bedrijfscode.

### Technische opzet backend

Node.js 18+ met Express, SQLite (better-sqlite3) als database, JWT voor authenticatie.
Mappenstructuur volgt een strikte scheiding van verantwoordelijkheden: `routes/` definieert
API-endpoints, `controllers/` bevat de logica, `models/` bevat uitsluitend databasequeries,
`services/` bevat achtergrondprocessen. De vorige groep noemt deze structuur expliciet als
reden dat het systeem onderhoudbaar bleef.

Drie achtergrondservices draaien continu: `PrinterService.js` (pollt printers voor status en
voortgang), `resinService.js` (ontvangt sensordata via TCP, converteert picofarad naar
percentages, logt metingen) en `queueWorker.js` (verwerkt de printjob-wachtrij en verstuurt
bestanden naar printers).

Configuratie loopt via een `.env`-bestand. Databasetabellen worden automatisch aangemaakt bij
het starten van de server.

## 9. Aandachtspunt: inloggegevens in de overgedragen documenten

> **Let op.** Het document `printfarm manager en sensor.docx` bevat concrete inloggegevens:
> SSH-credentials van de Raspberry Pi (inclusief wachtwoord en IP-adres) en het
> standaard admin-account van het dashboard. De vorige groep vermeldt er zelf bij dat deze
> bedoeld zijn voor ontwikkel- en testdoeleinden en in productie aangepast moeten worden.
>
> Die gegevens zijn hier bewust **niet** overgenomen. Zolang `Provided-Files/` in deze
> repository staat, staan ze wel in de git-geschiedenis. Maak deze repository daarom niet
> publiek zonder dit eerst te bespreken, en overweeg de map buiten versiebeheer te houden.
> Zie de discussie hierover bij het startoverleg.

## 10. Overzicht van de brondocumenten

Alle negen documenten staan in
[../Provided-Files/Printfarm_project_definitief/Definitief/](../Provided-Files/Printfarm_project_definitief/Definitief/):

| Document | Inhoud | Relevantie voor ons |
| --- | --- | --- |
| `Probleemdomein.docx` | Probleemanalyse, huidige workflow, C4-diagrammen, stakeholders, risico's | Hoog — beschrijft de context van Atum3D |
| `printfarm manager en sensor.docx` | Technische documentatie systeem, API-overzicht, installatie, troubleshooting | Hoog — het technische naslagwerk |
| `Onderzoek.docx` | Sensoronderzoek met onderbouwing, keuze frontend/backend | Hoog — voorkomt dubbel werk |
| `Reflectie.docx` | Geleerde lessen per beroepstaak, samenwerking met opdrachtgever | Hoog — valkuilen en procesadvies |
| `Programma van Eisen.docx` | MoSCoW-eisen, SMART geformuleerd | Middel — voorbeeldformat, en de scope van vorig jaar |
| `Plan van Aanpak.docx` | Fasering, planning, risicoanalyse, kwaliteitsbeheer, communicatieplan | Middel — bruikbaar als format voor ons eigen PvA |
| `Ontwerp.docx` | Ontwerpverslag, use-cases, architectuur | Middel |
| `Testplan.docx` | Testscenario's per eis | Middel — format voor ons eigen testplan |
| `Testrapport.docx` | Testresultaten en eindconclusie | Middel — laat zien wat wel/niet gevalideerd is |
