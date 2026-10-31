## Robot arm
| UC01 | Schone printplaat |
| -- | -- |
| Omschrijving | De robotarm hangt een schone printplaat in de printer |
| Actors | Printfarm manager, robotarm |
| Stappen | 1. De robotarm manager krijgt een signaal voor een specifieke printer die een schone printplaat nodig heeft <br> 2. De robotarm identificeerd de printplaat die bij de printer hoort <br> 3. De robotarm "grijpt" de printplaat <br> 4. De robotarm beweegt naar de juiste printer <br>5. De robotarm hangt de printplaat in de printer |
| Precondities | Er is een schone printplaat beschikbaar voor de juiste printer in het rek |
| Postcondities | De printplaat hangt in de juiste printer en is klaar voor gebruik |
| Excepties | Er zijn geen schone printplaten voor de gewenste printer aanwezig: <br> Robotarm manager stuurt signaal naar de printfarm operator dat er interventie nodig is |

| UC02 | Printplaat verwijderen |
| -- | -- |
| Omschrijving | De robotarm verwijdert een gebruikte printplaat uit de printer |
| Actors | Printfarm manager, robotarm |
| Stappen | 1. De robotarm manager krijgt een signaal dat er een printplaat moet worden verwijdert <br> 2. De robotarm beweegt naar de juiste printer toe <br> 3. De robotarm "grijpt" de printplaat <br> 4. De robotarm beweegt met de gebruikte printplaat naar het juiste rek <br> 5. De robotarm hangt de gebruikte printplaat op een lege plek in het rek |
| Precondities | De print is afgerond, er is ruimte in het rek van de gebruikte printplaten |
| Postcondities | De gebruikte printplaat hangt in het rek van de printplaten |
| Excepties | Er is geen ruimte in het rek voor gebruikte printplaten: <br> De robotarm manager stuurt signaal naar de printfarm operator dat er interventie nodig is |

## Printfarm manager
| UC03 | Printopdracht ontvangen |
| -- | -- |
| Omschrijving | De printmanager ontvangt een printopdracht |
| Actors | Printoperator |
| Stappen | 1. De printoperator verstuurd de printopdracht naar de printfarm manager <br> 2. De printfarm manager slaat de printopdracht op |
| Precondities | |
| Postcondities | De printopdracht is klaar om toebedeelt te worden |

| UC04 | Printopdracht starten |
| -- | -- |
| Omschrijving | De printfarm manager bedeeld de printopdracht toe aan de juiste printer en start het printproces |
| Actors | Printoperator, robotarm manager |
| Stappen | 1. De printfarm manager wordt gestart door de printoperator <br> 2. De printfarm manager controleert welke printers niet in gebruik zijn <br> 3. De printfarm manager controleert welke printers het juiste type resin hebben <br> 4. De printfarm manager controleert of er genoeg resin aanwezig is <br> 5. De printfarm manager geeft de robotarm manager signaal om een gebruikte printplaat te verwijderen <br> 6. De printfarm manager geeft signaal om een nieuwe printplaat in te hangen <br> 7. De printfarm manager stuurt de print naar de printer <br> 8. De printfarm manager stuurt signaal naar de printer dat de print gestart kan worden |
| Precondities | De printopdracht is ingeladen door een printoperator |
| Postcondities | De printer is begonnen met de printopdracht |
| Excepties | Er zijn geen printers beschikbaar: <br> De printerfarm manager stuurt signaal naar de printoperator en wacht tot er een printer beschikbaar is. <br> Er is geen printer die aan de resin eisen(soort, hoeveelheid) voldoet: <br> De printfarm manager stuurt signaal naar de printoperator <br> De robotarm kon de nieuwe printplaat niet inhangen: <br> De robotarmmanager geeft signaal van het probleem naar de printoperator |

## Dashboard
| UC05 | Printprocess inzien |
| -- | -- |
| Omschrijving | De printoperator kan het printproces in zien via het dashboard  |
| Actors | Printoperator, printfarm manager |
| Stappen | 1. Het dashboard geeft de relevante informatie weer |
| Precondities | De printfarm manager heeft de juiste data beschikbaar gesteld voor het dashboard |
| Postcondities | De printoperator kan zien hoe het printprocess verloopt |

| UC06 | Print pauzeren |
| -- | -- |
| Omschrijving | De printoperator pauzeert de print  |
| Actors | Printoperator, printfarm manager |
| Stappen | 1. De printoperator drukt op de pauzeer print knop <br> 2. De printfarmmanger krijgt signaal dat de print moet worden gepauzeerd <br> 3. De robotarm gaat naar de veilige positie |
| Precondities | Het dashboard is beschikbaar voor de printoperator |
| Postcondities | De print is gepauzeerd en de printers zijn te bereiken voor de printoperator doordat de arm stil staat in de veilige positie |

| UC06 | Print hervatten |
| -- | -- |
| Omschrijving | De printoperator hervat de print  |
| Actors | Printoperator, printfarm manager |
| Stappen | 1. De printoperator drukt op de hervat print knop <br> 2. De printfarmmanger krijgt signaal dat de print moet worden hervat |
| Precondities | Het dashboard is beschikbaar voor de printoperator |
| Postcondities | De print is gepauzeerd en de printers zijn te bereiken voor de printoperator doordat de arm stil staat in de veilige positie |
