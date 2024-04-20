# Morphic

An AI-powered answer engine with a generative UI.

![capture](/public/capture-240404_blk.png)

## 🔍 Overview

- 🧱 [Stack](#-stack)
- 🚀 [Quickstart](#-quickstart)
- 🌐 [Deploy](#-deploy)

## 🧱 Stack

- App framework: [Next.js](https://nextjs.org/)
- Text streaming / Generative UI: [Vercel AI SDK](https://sdk.vercel.ai/docs)
- Generative Model: [OpenAI](https://openai.com/)
- Search API: [Tavily AI](https://tavily.com/)
- Component library: [shadcn/ui](https://ui.shadcn.com/)
- Headless component primitives: [Radix UI](https://www.radix-ui.com/)
- Styling: [Tailwind CSS](https://tailwindcss.com/)

## 🚀 Quickstart

### 1. Fork and Clone repo

Fork the repo to your Github account, then run the following command to clone the repo:

```
git clone git@github.com:[YOUR_GITHUB_ACCOUNT]/morphic.git
```

### 2. Install dependencies

```
cd morphic
bun i
```

### 3. Fill out secrets

```
cp .env.local.example .env.local
```

Your .env.local file should look like this:

```
# Used to set the base URL path for OpenAI API requests.
# If you need to set a BASE URL, uncomment and set the following:
# OPENAI_API_BASE=

# Used to set the model for OpenAI API requests.
# If not set, the default is gpt-4-turbo.
# OPENAI_API_MODEL='gpt-4-turbo'

# OpenAI API key retrieved here: https://platform.openai.com/api-keys
OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]

# Tavily API Key retrieved here: https://app.tavily.com/home
TAVILY_API_KEY=[YOUR_TAVILY_API_KEY]
```

**Note: This project focuses on Generative UI and requires complex output from LLMs. Currently, it's assumed that the official OpenAI models will be used. Although it is possible to set up other models, if you use an OpenAI-compatible model, please do so at your own risk.**

### 4. Run app locally

```
bun dev
```

You can now visit http://localhost:3000.

## 🌐 Deploy

Host your own live version of Morphic with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmiurla%2Fmorphic&env=OPENAI_API_KEY,TAVILY_API_KEY)
