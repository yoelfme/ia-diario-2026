# Week 11 — LangGraph RAG Agent

Document ingestion and a **LangGraph**-backed RAG agent using LangChain, OpenAI embeddings, and PGVector.

The project loads a PDF (`docs/codigo-civil.pdf`), splits it into chunks, generates embeddings, stores them in PostgreSQL, and exposes a compiled agent graph (`law_agent`) for LangGraph Studio or your own code.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (package manager)
- Docker (for PostgreSQL + pgvector via Compose)
- An OpenAI API key

## Setup

1. **Install dependencies**

   ```bash
   uv sync
   ```

2. **Configure environment variables**

   Create a `.env` file in this directory:

   ```bash
   OPENAI_API_KEY=sk-your-key-here
   ```

3. **Start PostgreSQL with pgvector**

   From this directory:

   ```bash
   docker compose up -d
   ```

   This uses [`compose.yml`](compose.yml): database `agentdb`, user/password `postgres`, port `5432`.

   The app connects to `postgresql+psycopg://postgres:postgres@localhost:5432/agentdb`.

4. **Ingest the PDF into the vector store**

   ```bash
   uv run ingestor.py
   ```

   This loads `docs/codigo-civil.pdf`, splits it into chunks of 1000 characters (with 200 overlap), generates embeddings with `text-embedding-3-large`, and stores them in the `codigos_de_guatemala` collection.

## Running

### LangGraph Studio (dev server)

[`langgraph.json`](langgraph.json) registers the graph as **`law_agent`**, loaded from `agent.py` (`agent`).

```bash
langgraph dev
```

Open the URL the CLI prints (LangGraph Studio) to run threads, inspect state, and try the agent with the configured tools and `.env`.

### Terminal (optional)

Uncomment the block at the bottom of [`agent.py`](agent.py) and run:

```bash
uv run agent.py
```

for a simple `input()`-driven session in the terminal.
