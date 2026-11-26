## Robot arm
| F01 | Printplaat vasthouden |
| Omschrijving | De robotarm moet de printplaat kunnen pakken/grijpen/inhaken |
| Rationale | Om de gewenste functionaliteit te behalen moet de printplaat worden verplaatst. Hiervoor is het belangrijk dat er wordt gezorgd dat deze niet valt. |
| Business prioriteit | Should have | 

| F02 | Robotarm verplaatsen |
| Omschrijving | De robotarm moet de grijper tussen twee punten verplaatsen |
| Rationale | Om de gewenste functionaliteit van het wisselen van printplaten te kunnen behalen moet de printplaat worden verplaatst. Om dit mogelijk te maken moet de robotarm tussen twee punten kunnen bewegen. |
| Business prioriteit | Must have | 

| F03 | Printplaat los laten |
| Omschrijving | De robotarm moet de printplaat los kunnen laten. |
| Rationale | De printplaat moet niet in de arm blijven hangen, omdat dan volgende stappen niet uitgevoerd kunnen worden. |
| Business prioriteit | Should have | 

| F04 | Printplaten bij printer houden |
| Omschrijving | Het systeem moet bij houden welke printplaten bij welke printer horen. |
| Rationale | Elke printer heeft printplaten die zijn gecalibreerd voor de specifieke printer. Deze moeten dus weer bij de juiste printer terecht komen, anders gaan de printers kapot. |
| Business prioriteit | Must have | 

| F05 | Posities bepalen |
| Omschrijving | Het systeem moet de locatie van relevante punten zoals de printers en printplaten weten |
| Rationale | Om te kunnen bewegen tussen de juiste punten moet het systeem wel weten wat deze punten zijn |
| Business prioriteit | Must have |

| F06 | Veilige positie |
| Omschrijving | De robotarm moet zich kunnen bewegen naar een veilige positie wanneer deze hier signaal voor ontvangt |
| Rationale | Het kan zijn dat een werknemer werkzaamheden in het bereik van de robotarm moet uitvoeren. Om dit veilig te kunnen doen moet de robotarm naar een veilige positie kunnen worden gestuurd |
| Business prioriteit | Must have |

| F07 | Robotarm status |
| Omschrijving | De robotarm moet de huidige status kunnen doorgeven aan andere onderdelen van het systeem |
| Rationale | Om nieuwe opdrachten te kunnen sturen wanneer de eerdere opdrachten zijn uitgevoerd moeten de andere onderdelen van het systeem wel weten of de robotarm klaar is met de vorige opdracht |
| Business prioriteit | Must have | 

## Print farm manager
| F08 | Printopdrachten ontvangen |
| Omschrijving | De printfarm manager moet printopdrachten van de operator kunnen ontvangen |
| Rationale | De printfarm manager moet zelfstandig prints kunnen toebedelen aan printers. Om dit mogelijk te maken moeten er wel prints kunnen worden ingeladen. |
| Business prioriteit | Must have | 

| F09 | Printopdrachten opslaan |
| Omschrijving | De printfarm manager moet printopdrachen opslaan voor later gebruik |
| Rationale | Om de printopdrachten later te kunnen sturen naar een printer moeten de printopdrachten in de tussentijd worden opgeslagen |
| Business prioriteit | Must have |

| F10 | Prints toebedelen |
| Omschrijving | De printfarm manager moet prints toebedelen aan geschikte printers. |
| Rationale | Om te zorgen dat het systeem zelfstandig door kan blijven gaan zonder tussenkomst van de medewerker moeten de prints bij de printer terecht komen. |
| Business prioriteit | Must have | 

| F11 | Prints starten |
| Omschrijving | De printfarm manager moet prints kunnen starten wanneer de printers hier klaar voor zijn. |
| Rationale | Om zelfstandig zonder tussenkomst van de medwerker door te kunnen produceren moeten prints gestart worden |
| Business prioriteit | Should have | 

| F12 | Printer beschikbaarheid controleren |
| Omschrijving | De printfarmmanager controleerd welke printers beschikbaar zijn en welke printers bezig zijn. |
| Rationale | Om prints te kunnen toebedelen moet eerst bekend zijn welke printers beschikbaar zijn voor een nieuwe printopdracht |
| Business prioriteit | Must have |

| F13 | Printer condities controleren |
| Omschrijving | De printfarm manager moet relevante parameters controleren voordat prints worden toebedeeld. |
| Rationale | Om te zorgen dat de print goed en op de juiste manier kan worden uitgevoerd moet de printfarm manager kijken of de printer aan alle relevante parameters voldoet |
| Business prioriteit | Must have | 

| F14 | Opdrachten versturen naar robotarm |
| Omschrijving | De printfarm manager moet opdrachten naar de robotarm kunnen versturen |
| Rationale | Om de werkzaamheden te kunnen uitvoeren moet de robotarm aangestuurd kunnen worden. |
| Business prioriteit | Must have |

## Dashboard
| F15 | Systeem status weergeven |
| Omschrijving | Het dashboard moet relevante status informatie over printers, de robotarm en de printfarm manager weergeven. |
| Rationale | Om de print operator inzicht te geven in het verloop van het proces moet data worden weergegeven |
| Business prioriteit | Must have | 

| F16 | Prints pauzeren |
| Omschrijving | De printoperator pauzeert de robotarm |
| Rationale | Om werkzaamheden rondom de printers veilig uit te kunnen voeren moet de robotarm worden gepauzeerd |
| Business prioriteit | Should have | 

| F17 | Prints hervatten |
| Omschrijving | De printoperator hervat de robot arm zodat deze verder kan gaan met diens werkzaamheden |
| Rationale | Het is niet gewenst dat de robotarm onnodig stil blijft staan na het pauzeren van de print. De werkzaamheden moeten worden hervat. |
| Business prioriteit | Should have | 

| F18 | Errors weergeven |
| Omschrijving | Het dashboard geeft errors binnen het systeem weer |
| Rationale | Het is voor de printoperator belangrijk om inzicht te hebben op onderdelen die fout gaam, of interventie nodig hebben zodat het proces weer hervat kan worden |
| Business prioriteit | Must have | 

| F19 | Printqueue weergeven |
| Omschrijving | Het dashboard moet de printqueue weergeven |
| Rationale | Om de printoperator inzicht te geven in hoeveel prints er nog open staan is het belangrijk dat deze de queue kan zien |
| Business prioriteit | Should have |

| F20 | Printqueue prioriteit wijzigen |
| Omschrijving | De printfarm operator moet wijzigingen in de printvolgorde van prints in de queue kunnen doen. |
| Rationale | Het kan zijn dat er later een printopdracht met hogere prioriteit is. Deze moet dus eerder uitgevoerd kunnen worden |
| Business prioriteit | Should have | 
