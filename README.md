# Knuddels UserApps Test-Umgebung

Lokale Sandbox zum Entwickeln und Testen von Knuddels UserApps ohne FTP-Upload.

## Setup

```bash
npm install
npm run dev
```

Das öffnet:
- Den **Test-Server** auf http://localhost:3000 (UserApp-Sandbox + Frontend-Hosting)
- Die **Debug-UI** auf http://localhost:5173 (React-SPA für Event-Simulation)

## UserApp ablegen

Lege deine App im Ordner `apps/<app-id>/` ab — wie ein FTP-Upload:

```
apps/
└── meine-app/
    ├── main.js          # Server-Logik
    ├── app.config       # Properties-Format
    └── www/
        └── index.html   # Frontend
```

Änderungen werden per Watcher automatisch neu geladen.

## Was simuliert werden kann

Über die Debug-UI:
- User anlegen, in Channel joinen / leaven
- Public/Private Messages, Action Messages senden
- Slash-Commands (`/...`) triggern
- Beliebige `appEvent`-Frames vom Frontend simulieren
- AppContent-Frame im iframe öffnen + Frontend-↔-Backend-Events live verfolgen
- Persistenz-JSON (`/.test-env/persistence/<appId>.json`) live einsehen + editieren

## Nicht-Ziele

Keine 100%ige Knuddels-Treue (kein Rhino, keine ES5-Limits, kein echtes Threading-Modell). Sinn ist schnelles iteratives Entwickeln.
