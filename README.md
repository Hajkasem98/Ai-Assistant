# Mesta AI Assistent

Ein RAG-basert (Retrieval-Augmented Generation) chatbot for Mesta-ansatte. Assistenten henter relevant informasjon fra interne dokumenter via Azure AI Search og genererer svar på norsk ved hjelp av Azure OpenAI.

---

## Innhold

- [Arkitektur](#arkitektur)
- [Teknologier](#teknologier)
- [Krav](#krav)
- [Oppsett og konfigurasjon](#oppsett-og-konfigurasjon)
- [Kjøre lokalt](#kjøre-lokalt)
- [API-referanse](#api-referanse)
- [Prosjektstruktur](#prosjektstruktur)
- [Deployment](#deployment)

---

## Arkitektur

```
Bruker → React-frontend (TypeScript + Vite)
              ↓  REST / streaming
         ASP.NET Core API (.NET 8)
              ↓                    ↓
    Azure AI Search          Azure OpenAI
    (vektorsøk / RAG)        (chat completions)
```

Flyten for hvert spørsmål:

1. Frontend sender spørsmålet til backenden.
2. Backenden søker i Azure AI Search etter relevante dokumentchunks (vektorsøk).
3. Chunks brukes som kildeblokk i prompten til Azure OpenAI.
4. Svaret streames tilbake til frontend og vises som bobler med kildelenker.

Chathistorikk er **klientstyrt** – ingen database. Frontend sender de siste meldingene med i hver forespørsel.

---

## Teknologier

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Autentisering (frontend) | MSAL / Azure AD (`@azure/msal-react`) |
| Tale-til-tekst | Azure Cognitive Services Speech SDK |
| Backend | ASP.NET Core (.NET 8) |
| Autentisering (backend) | Microsoft.Identity.Web (Azure AD) |
| LLM | Azure OpenAI (GPT-modell + embedding) |
| Søk | Azure AI Search (semantisk + vektorsøk) |
| Deployment | Azure Static Web Apps (frontend) + Azure Container Apps (backend) |

---

## Krav

Sørg for at følgende er installert:

- [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
- [Node.js LTS](https://nodejs.org/) (inkluderer npm)

Du trenger også tilgang til:

- En **Azure OpenAI**-ressurs med chat- og embedding-deployments
- En **Azure AI Search**-ressurs med et ferdig indeksert søkeindeks
- En **Azure AD**-appregistrering (for innlogging)
- *(Valgfritt)* Azure Cognitive Services Speech-ressurs for tale-til-tekst

---

## Oppsett og konfigurasjon

### Backend – `src/appsettings.json`

Fyll inn tomme felt:

```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<din-tenant-id>",
    "ClientId": "<din-klient-id>",
    "Audience": "api://<din-klient-id>"
  },
  "AzureOpenAI": {
    "Endpoint": "https://<ressursnavn>.openai.azure.com/",
    "ApiKey": "<api-nøkkel>",
    "ChatDeployment": "gpt-4o-mini",
    "EmbeddingDeployment": "text-embedding-3-large",
    "ApiVersion": "2024-02-15-preview"
  },
  "AzureSearch": {
    "Endpoint": "https://<søkeressurs>.search.windows.net",
    "ApiKey": "<api-nøkkel>",
    "IndexName": "<indeksnavn>",
    "ContentField": "content_text",
    "TitleField": "document_title",
    "UrlField": "sharepoint_url,content_path",
    "DocumentIdField": "text_document_id"
  },
  "SharePoint": {
    "BlobPrefix": "https://<lagringskonto>.blob.core.windows.net/<container>/<sti>/",
    "Host": "https://<din-tenant>.sharepoint.com",
    "LibraryPage": "/sites/<ditt-nettsted>/<ditt-dokumentbibliotek>/Forms/AllItems.aspx",
    "RootPath": "/sites/<ditt-nettsted>/<ditt-dokumentbibliotek>/<rotmappe>",
    "ViewId": "<sharepoint-visnings-id>"
  },
  "Speech": {
    "Key": "<valgfritt>",
    "Region": "<valgfritt, f.eks. norwayeast>"
  },
  "Cors": {
    "AllowedOrigins": [ "https://<din-static-web-app>.azurestaticapps.net" ]
  }
}
```

> **Merk:** Feltnavn for søkeindeksen (`ContentField`, `TitleField` osv.) må samsvare med din faktiske indeksstruktur. `SharePoint`-seksjonen er valgfri – uten den returneres kildenes originale URL uendret (ingen mapping til SharePoint-visning).

### Frontend – miljøvariabler

Lag filen `frontend/.env.local`:

```env
VITE_API_BASE_URL=https://localhost:5001
VITE_AAD_CLIENT_ID=<din-azure-ad-klient-id>
VITE_AAD_TENANT_ID=<din-azure-ad-tenant-id>
```

For produksjon settes `VITE_API_BASE_URL` i GitHub Actions-workflowen (se [Deployment](#deployment)).

---

## Kjøre lokalt

### Backend

```bash
cd src
dotnet restore
dotnet run
```

API-et starter på `https://localhost:5001`.  
Swagger UI er tilgjengelig på `https://localhost:5001/swagger` i Development-modus.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starter på `http://localhost:5173` (standard Vite-port).

---

## API-referanse

Alle endepunkter ligger under `/api/chat`.

### `POST /api/chat` – enkelt svar

Returnerer et fullstendig svar (ikke-streamet).

**Request:**
```json
{
  "question": "Hvordan registrerer jeg overtid?",
  "topK": 4
}
```

**Response:**
```json
{
  "answer": "Kort svar:\n- Du registrerer overtid i ...",
  "sources": [
    {
      "title": "Overtidsregistrering — Rapporter",
      "url": "https://<your-tenant>.sharepoint.com/...",
      "contentSnippet": "Overtid registreres ved å..."
    }
  ]
}
```

---

### `POST /api/chat/stream` – streamet svar

Returnerer svaret som en kontinuerlig tekststrøm (`text/plain`). Brukes av frontend for live-visning av svar.

**Request:** Samme format som over.  
**Response:** Ren tekst, chunk for chunk.

---

### `POST /api/chat/sources` – hent kilder uten svar

Returnerer kun relevante kildetreff for et spørsmål.

**Request:** Samme format som over.  
**Response:** Liste med `SourceHit`-objekter (tittel, URL, snippet).

---

### `GET /api/chat/speech-token` – Azure Speech-token

Returnerer et midlertidig token for Azure Cognitive Services Speech (brukes av frontend for tale-til-tekst). Krever ikke autentisering.

**Response:**
```json
{
  "token": "<jwt-token>",
  "region": "norwayeast"
}
```

---

### Multi-turn (flerrunders) samtale

Send tidligere meldinger i `messages`-feltet for å gi modellen kontekst:

```json
{
  "question": "Kan du oppsummere det i to punkter?",
  "messages": [
    { "role": "user", "content": "Hvordan registrerer jeg overtid?" },
    { "role": "assistant", "content": "..." }
  ],
  "topK": 6
}
```

---

## Prosjektstruktur

```
Mesta-Assistent/
├── src/                                  # ASP.NET Core backend
│   ├── Controllers/
│   │   └── ChatController.cs            # API-endepunkter
│   ├── Services/
│   │   ├── ChatService.cs               # Orkestreringslogikk (RAG-flyt)
│   │   ├── PromptBuilder.cs             # Systempromt og kildeblokk
│   │   └── RetrievalService.cs          # Søk mot Azure AI Search
│   ├── Infrastructure/
│   │   ├── Llm/
│   │   │   └── AzureOpenAiRestClient.cs # REST-klient mot Azure OpenAI
│   │   └── Search/
│   │       └── AzureSearchRestClient.cs # REST-klient mot Azure AI Search
│   ├── Contracts/
│   │   ├── ChatRequest.cs
│   │   └── ChatResponse.cs
│   ├── Utils/
│   │   └── SharePointUrlMapper.cs       # Mapper dokumentstier til SharePoint-URLer
│   ├── Program.cs
│   ├── appsettings.json
│   └── Dockerfile
│
├── frontend/                             # React-frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx           # Meldingsvisning
│   │   │   ├── Bubble.tsx               # Enkelt meldingsboble
│   │   │   ├── Composer.tsx             # Inntastingsfelt
│   │   │   ├── Sidebar.tsx              # Chathistorikk-panel
│   │   │   ├── Header.tsx
│   │   │   ├── InfoModal.tsx
│   │   │   ├── SourcesList.tsx          # Visning av kildelenker
│   │   │   └── SuggestionCard.tsx       # Forslagsknapper på tom skjerm
│   │   ├── services/
│   │   │   ├── chatApi.ts               # Kall mot backend (stream + sources)
│   │   │   └── speechService.ts         # Tale-til-tekst via Azure Speech
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx         # MSAL-innlogging
│   │   │   └── msalConfig.ts            # Azure AD-konfigurasjon
│   │   ├── hooks/
│   │   │   └── useIsDesktop.ts
│   │   ├── types/
│   │   │   └── chat.ts                  # TypeScript-typer
│   │   ├── utils/
│   │   │   └── chatUtils.ts             # Hjelpefunksjoner (localStorage, ID-generering)
│   │   └── App.tsx                      # Rotkomponent
│   ├── package.json
│   └── vite.config.ts
│
├── .github/workflows/
│   └── azure-static-web-apps-*.yml      # CI/CD til Azure Static Web Apps
└── AiAssistant.sln
```

---

## Deployment

### Frontend – Azure Static Web Apps

Frontenden deployes automatisk via GitHub Actions ved push til `main`. Workflowen bygger Vite-appen og laster den opp til Azure Static Web Apps.

Konfigurer følgende secret i GitHub-repoet:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`

### Backend – Azure Container Apps

Backenden kjøres som en container. Bruk `src/Dockerfile` til å bygge og deploye til Azure Container Apps (eller annen container-plattform).

```bash
docker build -f src/Dockerfile -t mesta-assistent-api .
```

> Husk å sette alle miljøvariabler/secrets i Container Apps-konfigurasjonen i stedet for `appsettings.json` i produksjon.