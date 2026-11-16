# Printer sim

De printersim kan gebruikt worden als replacement voor een 'echte' printer. Het bevat 2 bestanden:

- app.py
- ws_test_server.py

## Hoe run je de server

1. Installeer de requirements in requirements.txt (pip install -r requirements.txt)
2. Run python app.py
3. Ga in je browser naar localhost:5000

Ik heb voor het testen de ws_test_server.py gebruik om te kijken of app.py goed messages verstuurd over websockets. Ik gok dat jullie hiervoor jullie eigen server gebruiken.
Mochten er dingen niet lekker aansluiten op jullie server vanuit onze kant, dan zou ik zeggen pas het aan in de app.py. Met het behoudt van de structuur van de mock data is het systeem redelijk flexibel.

## Hoe werken de logs

De printer maakt verbinding met een websocketserver, verander vooral het ip in de variabele EXTERNAL_LOG_WS
Elke log die men stuurt (vanuit de browser) gaat naar de websocketserver. In die log zie je de message, timestamp (ts) en het level. Als het level error is dan is het foute boel!

## Hoe werkt het voor de REST (^\_ ^)

In je browser kan je waardes updaten, deze waardes kan je dan GETten op de volgende endpoints:

** /progress **
Hoever de huidige printjob is, dit is te configureren in het web

** /printer_state **
De state van de printer bevat welke printjobs er op de usb of op de printer zelf staan

** /printer_config **
Bevat informatie over de printer, dit zal niet tijdens een printjob worden geupdate, dit zijn dingen als de naam van de printer, ip adres, sensoren, of het een top down printer is etc.

** /current_print_job_metadata **
De naam, resin, duration etc. van de huidige printjob
