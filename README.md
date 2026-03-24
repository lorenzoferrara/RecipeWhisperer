# RecipeWhisperer

RecipeWhisperer e una web app di ricette con bot Telegram integrato.

Il bot riceve ricette in linguaggio naturale, le struttura con Gemini e aggiorna automaticamente il file dati sul repository GitHub. Il frontend carica e mostra le ricette dal file JSON.

## Features

- Catalogo ricette in frontend statico
- Filtri per tipo/cucina e ricerca testuale
- Bot Telegram con comandi per aggiungere, visualizzare ed eliminare ricette
- Aggiornamento automatico del file `data/recipes.json` tramite GitHub API
- Deploy semplice su Vercel

## Struttura Progetto

- `index.html` UI principale
- `style.css` stile della pagina
- `script.js` logica frontend e rendering ricette
- `data/recipes.json` archivio ricette usato dal frontend
- `api/bot.js` webhook Telegram (Vercel Serverless Function)
- `scripts/serve.py` server locale per sviluppo frontend
- `vercel.json` configurazione deploy Vercel

## Requisiti

- Python 3.11+
- Account Telegram (bot gia creato)
- API key Gemini
- Repository GitHub con token di accesso per commit

## Avvio Locale (Frontend)

Dal root del progetto:

```bash
python3 scripts/serve.py
```

Apri poi:

```text
http://localhost:8000
```

## Deploy su Vercel

1. Collega il repository a Vercel.
2. Mantieni la root del progetto come output statico (config gia presente in `vercel.json`).
3. Configura le Environment Variables nel progetto Vercel.

## Environment Variables

Imposta queste variabili per la funzione serverless `api/bot.js`:

- `TELEGRAM_TOKEN`: token del bot Telegram
- `GEMINI_API_KEY`: API key Gemini
- `GITHUB_TOKEN`: token GitHub con permessi di lettura/scrittura contenuti
- `GITHUB_REPO`: repository target in formato `owner/repo`
- `ALLOWED_CHAT_ID`: chat id Telegram autorizzato a usare il bot

## Comandi Telegram

- `/start` o `/help` mostra guida e comandi
- `/view` mostra elenco ricette con id
- `/view <id>` mostra dettagli di una ricetta
- `/delete <id>` elimina una ricetta
- Testo libero con ricetta completa: aggiunge una nuova ricetta

## Flusso Aggiunta Ricetta

1. Telegram invia il messaggio al webhook su Vercel.
2. `api/bot.js` valida chat id e contenuto.
3. Gemini converte il testo in JSON ricetta.
4. La funzione scarica `data/recipes.json` da GitHub.
5. Aggiunge ricetta con nuovo id e commit su GitHub.
6. Il frontend visualizza la nuova ricetta dopo aggiornamento del file.

## Note

- Il frontend carica i dati da `data/recipes.json`.
- Le immagini ricetta sono opzionali; in assenza viene mostrato un fallback grafico.
- La funzione bot usa Markdown nei messaggi Telegram.