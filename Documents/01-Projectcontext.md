# Projectcontext

**Project:** HU Innovation Project 2026 — Atum3D
**Opdrachtgever:** Atum3D
**Status:** Startfase, vóór het digitale startoverleg van woensdag 9 september 2026
**Versie:** 0.1 (concept)
**Laatst bijgewerkt:** 7 september 2026

> Dit document legt vast wat er bij de start van het project bekend is, op basis van de
> mail van de projectleiding met de antwoorden van Atum3D en de overgedragen documentatie
> van de vorige projectgroep. Het is een levend document: na het startoverleg moet het
> worden bijgewerkt met de gemaakte afspraken.

---

## 1. Waar gaat dit project over

Atum3D ontwikkelt en levert resin-3D-printers, de bijbehorende software en een printservice.
Afnemers zitten onder andere in de medische sector (braces, protheses, gepersonaliseerde
hulpmiddelen).

Een vorige HU-projectgroep heeft in het studiejaar 2025–2026 een Proof of Concept gebouwd
voor een **printfarm manager**: een centraal dashboard met automatische resinmonitoring via
een capacitieve sensor. Dat systeem is opgeleverd en werkt, maar is nog niet gevalideerd op
fysieke printers. Zie [02-Overdracht-vorige-projectgroep.md](02-Overdracht-vorige-projectgroep.md).

Dit project bouwt daarop voort. De richting die de opdrachtgever aangeeft, gaat een stap
verder dan het vorige project.

## 2. Gewenste richting volgens de opdrachtgever

Tristam Budel (Atum3D) heeft de ambitie voor dit project als volgt verwoord:

> "Ik wil heel graag een afspraak met ze maken waarbij we verder gaan dan een theorie- of
> testmodelletje. Ik zou heel graag echt iets doen dat werkt met een bewegende robot en
> printende printers. Dat is nog een beetje vaag maar dat is wel de richting die ik op wil."

Hieruit volgen drie signalen die het project sturen:

1. **Werkend in de praktijk, niet alleen een demo.** Het eindresultaat moet draaien op echte
   hardware met echte printers, niet op een simulatie. Dit is een directe reactie op de
   beperking van het vorige project, waar de eindtest met fysieke printers niet mogelijk was.
2. **Een bewegende robot is onderdeel van de scope.** Denk aan het automatisch afhandelen van
   een printcyclus — bijvoorbeeld het uitnemen van een geprint object. Let op: dit was bij de
   vorige groep expliciet een *Won't-have* (eis W2), dus hier ligt nog geen voorwerk.
3. **De scope is nog niet scherp.** De opdrachtgever geeft zelf aan dat de richting "nog een
   beetje vaag" is. Het scherp krijgen van de opdracht is daarmee de eerste taak van dit
   project, niet iets dat we als gegeven kunnen aannemen.

## 3. Antwoorden van Atum3D op de startvragen

Onderstaande vragen zijn vóór de start gesteld aan Atum3D; de antwoorden komen uit de mail
van de projectleiding.

| Vraag | Antwoord van Atum3D |
| --- | --- |
| Met welke software of programma's moeten de studenten kunnen werken? | Visual Studio Code, KiCad, Fusion 360, Autodesk Inventor, Visual Studio 2020, plus werken met STM32 en Raspberry Pi. |
| Waar kunnen de studenten zich alvast in inlezen? | Pascal de Joode deelt de projectdocumentatie (naast de al ontvangen documentatie over de capacitieve resinsensor). |
| Is er materiaal dat de studenten alvast kunnen inzien? | Pascal wordt gevraagd een 3D-print-SOP te delen, als voorbeeld van een handmatig proces. |
| Tegen welke operationele, technische of procesmatige knelpunten loopt de organisatie aan? | Vraag werd niet begrepen — moet opnieuw en concreter gesteld worden. Zie [03-Vragen-startoverleg.md](03-Vragen-startoverleg.md). |
| Moet de oplossing aansluiten op bestaande systemen en architectuur? | Ja. Het te bouwen systeem moet aansluiten op de huidige programmatuur, architectuur en infrastructuur van Atum3D. |

### Wat deze antwoorden betekenen voor ons

**De toolinglijst verraadt de breedte van het project.** De genoemde tools bestrijken drie
disciplines tegelijk:

- *Elektronica:* KiCad — het ontwerpen van een printplaat. De vorige groep beveelt expliciet
  aan om de sensoropstelling van breadboard naar een echte PCB (shield op de STM32) te
  brengen. Dat sluit hier direct op aan.
- *Mechanisch ontwerp:* Fusion 360 en Autodesk Inventor — 3D-modellering, passend bij het
  bouwen van een fysieke opstelling of robotconstructie.
- *Software en embedded:* Visual Studio Code, Visual Studio 2020, STM32, Raspberry Pi.

Verwacht dus dat de opdracht hardware, mechanica én software combineert. Het is verstandig
om vroeg in kaart te brengen wie in het team welke discipline oppakt.

**De SOP is een belangrijke hint.** Dat Atum3D een SOP (Standard Operating Procedure) voor
het 3D-printproces wil delen "als voorbeeld van een handmatig proces" suggereert dat het
project draait om het automatiseren van een nu handmatige procedure. De SOP is daarmee
waarschijnlijk de beste bron voor het bepalen van de scope: welke handmatige stap gaan we
automatiseren?

**Aansluiten op bestaande infrastructuur is een harde randvoorwaarde.** We ontwerpen niet op
een groen veld. Voordat we architectuurkeuzes maken, moeten we de bestaande programmatuur en
infrastructuur van Atum3D kennen. Concreet: de printerfirmware (STM32), de Raspberry Pi's in
de printers, de communicatie via WebSocket of REST, en de bestaande printfarm manager van de
vorige groep.

## 4. Betrokkenen

De namen hieronder komen uit de documentatie van de vorige projectgroep. **Verifieer bij het
startoverleg wie voor dit project de betrokkenen zijn** — rollen kunnen gewijzigd zijn.

| Rol | Persoon | Toelichting |
| --- | --- | --- |
| Opdrachtgever | Tristam Budel (Atum3D) | Formuleert de doelstelling, geeft feedback op tussenresultaten. |
| Technisch contactpersoon | Pascal de Joode (Electrical Engineer, Atum3D) | Eerste aanspreekpunt voor technische vragen; deelt documentatie en de SOP. |
| Projectleiders Campus Gouda | Marijke Menting, Jitse de Vries | Ondersteuning en communicatie richting opdrachtgever. |
| Projectbegeleider HU | *nog te bevestigen* | Was bij de vorige groep Marinus Maris. |
| Projectteam | *in te vullen* | Namen en studentnummers van dit team. |

## 5. Randvoorwaarden en aandachtspunten

- **Aansluiting op bestaande architectuur is verplicht**, geen vrije technologiekeuze.
- **Werken met fysieke hardware is het doel.** De beschikbaarheid van echte printers is
  daarmee een projectrisico van de eerste orde. De vorige groep kon door een verbouwing bij
  Atum3D niet op echte printers testen en moest terugvallen op een simulatiescript. Check
  vroeg of dit nu wél kan, en plan het testen niet pas aan het eind.
- **Een bewegende robot brengt veiligheidsvragen mee.** Bewegende apparatuur in combinatie
  met resin (een chemische stof) vraagt om afspraken over veiligheid, afscherming en waar we
  mogen werken. Dit moet vroeg besproken worden.
- **Verwachtingen van een bedrijf verschillen van die van school.** De vorige groep kreeg
  scherpe feedback op hun Plan van Aanpak, terwijl school datzelfde document goed vond. Hun
  advies: laat documenten eerst door Atum3D lezen vóór een formele presentatie, zodat je niet
  in een vergadering wordt verrast.
- **Plan afspraken ruim van tevoren in.** Een bedrijf heeft een volle agenda; de vorige groep
  noemt dit expliciet als leerpunt.

## 6. Wat we nog niet weten

Deze punten zijn nog open en bepalen samen de scope. Ze zijn uitgewerkt tot concrete vragen
in [03-Vragen-startoverleg.md](03-Vragen-startoverleg.md).

- Wat de robot precies moet doen, en welke robot beschikbaar is.
- Of we voortbouwen op de printfarm manager van de vorige groep, of iets nieuws bouwen.
- Welke printers beschikbaar zijn om op te testen, en vanaf wanneer.
- Wat de concrete knelpunten in de organisatie zijn (de vraag die niet begrepen werd).
- Welke deliverables en beoordelingsmomenten vanuit de HU gelden voor dit project.

## 7. Bronnen

- Mail van de projectleiding met de antwoorden van Atum3D op de startvragen.
- Documentatie vorige projectgroep, in [../Provided-Files/](../Provided-Files/) —
  negen documenten, samengevat in
  [02-Overdracht-vorige-projectgroep.md](02-Overdracht-vorige-projectgroep.md).
