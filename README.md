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

## UserApp registrieren

### Externe Ordner (empfohlen)

Die UserApp bleibt in ihrem eigenen Projektordner — egal wo auf der Platte, mit
eigenem Git-Repo, eigener Build-Pipeline. Du registrierst nur den Pfad, der
Watcher zieht Änderungen live rein. Kein Kopieren, keine Symlinks, kein
Vermischen mit dem Server-Repo.

Drei Wege, einen Pfad zu registrieren:

1. **Debug-UI → Apps-Panel → "Externen Ordner hinzufügen"**
   Nativer Folder-Picker, Auswahl wird in `.test-env/external-apps.json`
   persistiert und beim nächsten Start automatisch wieder eingehängt.
2. **Env-Var `KS_EXTERNAL_APPS`** (komma-separierte absolute Pfade) —
   ideal für Team-Setups oder CI:
   ```bash
   KS_EXTERNAL_APPS=/Users/me/work/my-app,/Users/me/work/other-app npm run dev
   ```
3. **Direkt die JSON editieren** — `.test-env/external-apps.json`.

Der App-Ordner braucht eine `app.config` mit `appName=...`; der `appName` wird
zur App-ID, unter der die App im Server registriert wird.

### `apps/`-Ordner (Fallback, FTP-Style)

Wer keinen externen Ordner nutzen will, kann eine App direkt unter
`apps/<app-id>/` ablegen — wie ein FTP-Upload:

```
apps/
└── meine-app/
    ├── main.js          # Server-Logik
    ├── app.config       # Properties-Format
    └── www/
        └── index.html   # Frontend
```

Inhalte von `apps/` sind per `.gitignore` ausgeschlossen, der Ordner selbst
bleibt versioniert (via `.gitkeep`).

In beiden Fällen lädt der Watcher Änderungen automatisch neu.

## Was simuliert werden kann

Über die Debug-UI:
- User anlegen, in Channel joinen / leaven
- Public/Private Messages, Action Messages senden
- Slash-Commands (`/...`) triggern
- Beliebige `appEvent`-Frames vom Frontend simulieren
- AppContent-Frame im iframe öffnen + Frontend-↔-Backend-Events live verfolgen
- Persistenz-JSON (`.test-env/persistence/<appId>.json`) live einsehen + editieren

## Nicht-Ziele

Keine 100%ige Knuddels-Treue (kein Rhino, keine ES5-Limits, kein echtes Threading-Modell). Sinn ist schnelles iteratives Entwickeln.
