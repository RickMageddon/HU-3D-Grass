# Vragen voor het startoverleg

**Overleg:** digitaal startoverleg, woensdag 9 september 2026
**Deelnemers:** Atum3D (Tristam Budel, Pascal de Joode), projectleiding, projectteam
**Versie:** 0.1 (concept)

> Deze vragen volgen uit de mail met de antwoorden van Atum3D en uit de overdracht van de
> vorige projectgroep. Ze zijn geordend op prioriteit: de vragen in blok 1 bepalen de scope
> en moeten woensdag beantwoord worden. De rest kan eventueel later.
>
> **Tip uit de overdracht:** stuur deze vragen vooraf toe. De vorige groep liep tegen
> uiteenlopende verwachtingen aan en adviseert Atum3D documenten vooraf te laten lezen in
> plaats van ze pas in de vergadering te presenteren.

---

## Blok 1 — Scope: wat gaan we precies bouwen

De opdrachtgever geeft zelf aan dat de richting "nog een beetje vaag" is. Dit blok is bedoeld
om die vaagheid om te zetten in een werkbare opdracht.

1. **Wat moet de robot precies doen?** De ambitie is "iets dat werkt met een bewegende robot
   en printende printers". Welke handeling neemt de robot over van de operator? Denk aan het
   uitnemen van een geprint object, het verplaatsen van een bouwplatform, of het wisselen van
   een resintray.

2. **Welke robot hebben we tot onze beschikking?** Is er al een robotarm of ander bewegend
   systeem aanwezig bij Atum3D, moeten we er een aanschaffen, of ontwerpen we die zelf? Dit
   heeft grote gevolgen voor de haalbaarheid binnen de projectduur.

3. **Bouwen we voort op de printfarm manager van de vorige groep, of beginnen we opnieuw?**
   Er ligt een werkend dashboard met backend, sensorintegratie en gebruikersbeheer. Is het de
   bedoeling dat de robotaansturing daarin geïntegreerd wordt, of staat dit project daar los
   van?

4. **Welke handmatige stap heeft de meeste prioriteit om te automatiseren?** De aangekondigde
   3D-print-SOP beschrijft een handmatig proces. Als we die SOP stap voor stap doorlopen: waar
   zit de meeste tijdwinst of het grootste foutrisico?

5. **Wat is voor Atum3D een geslaagd project?** Concreet: welk resultaat moet er in januari
   staan om dit project als geslaagd te beschouwen?

## Blok 2 — De niet-begrepen vraag, opnieuw gesteld

De vraag "tegen welke specifieke operationele, technische of procesmatige knelpunten loopt de
organisatie momenteel aan?" werd niet begrepen. Hieronder concreter opgesplitst:

6. **Waar in het productieproces gaat de meeste tijd verloren?** Bijvoorbeeld door wachten,
   handmatig controleren, of het opnieuw moeten uitvoeren van een mislukte print.

7. **Welke handeling moet een medewerker nu uitvoeren waarvan jullie zouden willen dat een
   machine het deed?**

8. **Wat gaat er in de praktijk het vaakst mis bij een printopdracht?**

9. **Wat weerhoudt Atum3D er op dit moment van om meer printers tegelijk te draaien?** Is dat
   ruimte, personeel, of het handmatige toezicht dat elke printer vraagt?

## Blok 3 — Hardware en testomgeving

Dit blok is kritiek vanwege de expliciete wens om verder te gaan dan een testmodel.

10. **Zijn er echte printers beschikbaar om op te testen, en vanaf wanneer?** De vorige groep
    kon door een verbouwing niet op fysieke printers testen en moest terugvallen op een
    simulatiescript. Eén harde eis is daardoor nooit gevalideerd. Als dit opnieuw een risico
    is, willen we dat nu weten en niet in januari.

11. **Werken we op locatie bij Atum3D of op school?** En als het op locatie is: op welke dagen
    en met welke toegang?

12. **Krijgen we een eigen printer of testopstelling tot onze beschikking, of delen we die met
    de productie?**

13. **Is het simulatiescript van de vorige groep nog beschikbaar?** Ook als we op echte
    printers testen, is een simulatie nuttig om sneller te kunnen ontwikkelen.

14. **Welk budget is er voor onderdelen?** En hoe verloopt het bestellen — via Atum3D of via
    school?

15. **Welke veiligheidseisen gelden er?** Een bewegende robot in combinatie met resin vraagt
    om afspraken over afscherming, noodstop en persoonlijke beschermingsmiddelen. Zijn er
    interne richtlijnen waar we ons aan moeten houden?

## Blok 4 — Bestaande systemen en integratie

Atum3D stelt als eis dat het systeem aansluit op de huidige programmatuur, architectuur en
infrastructuur.

16. **Kunnen we documentatie krijgen van de bestaande architectuur en API's?** Pascal zou de
    projectdocumentatie delen — is die inmiddels beschikbaar?

17. **Welke printermodellen en firmwareversies zijn in gebruik?** De vorige groep beschrijft
    zowel oude firmware (STM32F207VG, WebSocket) als nieuwe (Nucleo F767ZI, REST API). Welke
    variant staat er op de printers waarop wij gaan werken?

18. **Hoe kunnen we een printer aansturen vanaf een extern systeem?** Welke endpoints of
    protocollen zijn daarvoor beschikbaar?

19. **Zijn er beperkingen op het netwerk bij Atum3D?** Mogen wij apparaten aansluiten, en zo
    ja op welk netwerksegment?

20. **Wie beheert de broncode van de vorige groep?** Die staat nu in persoonlijke
    GitHub-accounts van oud-studenten. Heeft Atum3D een eigen kopie, en houden wij toegang?

## Blok 5 — Samenwerking en proces

21. **Hoe vaak overleggen we?** De vorige groep hield wekelijks contact met Atum3D en noemt dat
    als belangrijke verbetering nadat het in het begin misging. Wij stellen wekelijks voor.

22. **Wie is ons eerste aanspreekpunt voor technische vragen?** Bij de vorige groep was dat
    Pascal de Joode.

23. **Hoe wil Atum3D documenten ontvangen en beoordelen?** Concreet: kunnen we conceptversies
    vooraf toesturen, zodat feedback niet pas in een presentatie komt?

24. **Zijn er afspraken over vertrouwelijkheid?** Mag onze code publiek op GitHub, of moet die
    privé blijven? Dit speelt direct: de overgedragen documentatie bevat inloggegevens van de
    Raspberry Pi, en die staat nu in onze repository.

## Blok 6 — Vanuit school

25. **Welke deliverables verwacht de HU en op welke momenten?** Bij de vorige groep waren dat
    Probleemdomein, Programma van Eisen, Ontwerpverslag, Proof of Concept, Testplan en
    Testrapport, verdeeld over een analysefase en zes sprints.

26. **Wie is onze projectbegeleider vanuit de HU?**

27. **Welke beroepstaken kiezen we als groep, en welke individueel?** Bij de vorige groep
    lagen A-1, G-a, G-c en G-f vast en koos de groep er drie bij.

## Voor te bereiden vóór het overleg

- [ ] Vragen vooraf toesturen aan Atum3D en de projectleiding
- [ ] Nagaan of Pascals projectdocumentatie en de 3D-print-SOP al zijn ontvangen
- [ ] Teamleden en rolverdeling op een rij zetten
- [ ] Deze repository klaarzetten om te delen, of juist besluiten dat te wachten vanwege de
      inloggegevens in `Provided-Files/`
