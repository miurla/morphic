# Morphic

Vyhledávač poháněný umělou inteligencí s generativním uživatelským rozhraním.

![capture](/public/capture-240404_blk.png)

> [!POZNÁMKA]
> Upozorňujeme, že mezi tímto úložištěm a oficiálními webovými stránkami [morphic.sh](https://morphic.sh) existují rozdíly. Oficiální webová stránka je forkem tohoto úložiště s dalšími funkcemi, jako je ověřování, které jsou nezbytné pro poskytování služby online. Jádro zdrojového kódu služby Morphic se nachází v tomto úložišti a je navrženo tak, aby se dalo snadno sestavit a nasadit.


## 🗂️ Přehled

- 🛠 [Funkce](#-features)
- 🧱 [Zásobník](#-zásobník)
- 🚀 [Quickstart](#-rychlý start)
- 🌐 [Deploy](#-deploy)
- 🔎 [Search Engine](#-search-engine)
- ✅ [Ověřené modely](#-verified-models)

## 🛠 Funkce

- Vyhledávání a odpovídání pomocí GenerativeUI
- Porozumění otázkám uživatele
- Funkce historie vyhledávání
- Sdílení výsledků vyhledávání ([Volitelné](https://github.com/miurla/morphic/blob/main/.env.local.example)).
- Podpora vyhledávání videí ([Volitelné](https://github.com/miurla/morphic/blob/main/.env.local.example))
- Získávání odpovědí ze zadaných adres URL
- Použití jako vyhledávač [※](#-search-engine)
- Podpora jiných poskytovatelů než OpenAI
  - Podpora poskytovatele generativní umělé inteligence Google [※](https://github.com/miurla/morphic/issues/192)
  - Podpora poskytovatele Ollama ([Unstable](https://github.com/miurla/morphic/issues/215)).
- Zadání modelu pro generování odpovědí
  - Podpora rozhraní Groq API [※](https://github.com/miurla/morphic/pull/58)

## 🧱 Zásobník

- Rámec aplikace: [Next.js](https://nextjs.org/)
- Streamování textu / generativní uživatelské rozhraní: [Vercel AI SDK](https://sdk.vercel.ai/docs)
- Generativní model: [OpenAI](https://openai.com/)
- Vyhledávací rozhraní API: [Tavily AI](https://tavily.com/) / [Serper](https://serper.dev)
- Rozhraní API pro čtení: [Jina AI](https://jina.ai/)
- Databáze bez serveru: [Upstash](https://upstash.com/)
- Knihovna komponent: [shadcn/ui](https://ui.shadcn.com/)
- Primitiva bezhlavých komponent: [Radix UI](https://www.radix-ui.com/)
- Stylování: [Tailwind CSS](https://tailwindcss.com/)

## 🚀 Rychlý start

### 1. Fork and Clone repo

Forkněte repozitář na svůj účet Github a poté spusťte následující příkaz pro klonování repozitáře:

```
git clone git@github.com:[YOUR_GITHUB_ACCOUNT]/morphic.git
```

### 2. Nainstalujte závislosti

```
cd morphic
bun install
```

### 3. Nastavení Upstash Redis

Podle níže uvedeného návodu nastavte Upstash Redis. Vytvořte databázi a získejte `UPSTASH_REDIS_REST_URL` a `UPSTASH_REDIS_REST_TOKEN`. Pokyny k dalšímu postupu naleznete v příručce [Upstash guide](https://upstash.com/blog/rag-chatbot-upstash#setting-up-upstash-redis).

### 4. Vyplňte tajemství

```
cp .env.local.example .env.local
```

Váš soubor .env.local by měl vypadat takto:

```
# OpenAI API klíč získaný zde: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# Tavily API Key načtený zde: https://app.tavily.com/home
TAVILY_API_KEY=

# URL a token Upstash Redis načtené zde: https://console.upstash.com/redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

_Poznámka: Tento projekt se zaměřuje na generativní uživatelské rozhraní a vyžaduje komplexní výstup z LLM. V současné době se předpokládá, že budou použity oficiální modely OpenAI. Je sice možné nastavit i jiné modely, pokud použijete model kompatibilní s OpenAI, ale nezaručujeme, že to bude fungovat._``

### 5. Spusťte aplikaci lokálně

```
bun dev
```

Nyní můžete navštívit stránku http://localhost:3000.

## 🌐 Deploy

Hostujte vlastní živou verzi Morphic pomocí Vercel nebo Cloudflare Pages.

#### Vercel

[![Deploy s Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmiurla%2Fmorphic&env=OPENAI_API_KEY,TAVILY_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

### Cloudflare Pages

1. Rozšiřte repozitář na svůj GitHub.
2. Vytvořte projekt Cloudflare Pages.
3. Vyberte repo `Morphic` a předvolbu `Next.js`.
4. Nastavte proměnné env `OPENAI_API_KEY` a `TAVILY_API_KEY`.
5. Uložte a nasaďte.
6. Zrušte nasazení, přejděte do `Nastavení` -> `Funkce` -> `Příznaky kompatibility`, přidejte `nodejs_compat` do náhledu a produkce.
7. Znovu nasaďte.

**Je třeba opravit chybu sestavení: [issue](https://github.com/miurla/morphic/issues/114)**.

## 🔎 Vyhledávač

### Nastavení vyhledávače v prohlížeči

Pokud chcete používat Morphic jako vyhledávač v prohlížeči, postupujte podle následujících kroků:

1. Otevřete nastavení prohlížeče.
2. Přejděte do části nastavení vyhledávače.
3. Vyberte možnost "Spravovat vyhledávače a vyhledávání na webu".
4. V části "Vyhledávání na webu" klikněte na tlačítko "Přidat".
5. Vyplňte následující pole:
   - **Vyhledávač**: Vyhledávač: Morphic
   - **Zkratka**: morphic
   - **URL s %s na místě dotazu**: `https://morphic.sh/search?q=%s`
6. Kliknutím na tlačítko "Add" (Přidat) uložte nový vyhledávač.
7. Najděte v seznamu vyhledávačů stránek "Morphic", klikněte na tři tečky vedle něj a vyberte možnost "Make default".

To vám umožní používat Morphic jako výchozí vyhledávač v prohlížeči.

## ✅ Ověřené modely

#### Seznam modelů použitelných pro všechny:

- OpenAI
  - gpt-4o
  - gpt-4-turbo
  - gpt-3.5-turbo
- Google
  - Gemini 1.5 pro [※](https://github.com/miurla/morphic/issues/192)
- Ollama (nestabilní)
  - Mistral/openhermes & Phi3/llama3 [※](https://github.com/miurla/morphic/issues/215)

### Seznam ověřených modelů, které lze zadat zapisovatelům:

- [Groq](https://console.groq.com/docs/models)
  - LLaMA3 8b
  - LLaMA3 70b Přeloženo pomocí www.DeepL.com/Translator (bezplatná verze)
