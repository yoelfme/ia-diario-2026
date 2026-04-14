# Week 8 — Vectors & Vector Store (RAG)

Examples of document ingestion and semantic search using LangChain, OpenAI embeddings, and PGVector.

The project loads a PDF (`docs/codigo-de-trabajo.pdf`), splits it into chunks, generates embeddings, stores them in a PostgreSQL vector store, and lets you query them with similarity search.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (package manager)
- PostgreSQL with the `pgvector` extension enabled
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

3. **Set up PostgreSQL with pgvector**

   Run a PostgreSQL container with pgvector already enabled:

   ```bash
   docker run -d \
     --name pgvector \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=week_8 \
     -p 5432:5432 \
     pgvector/pgvector:pg18-trixie
   ```

   The scripts connect to `postgresql+psycopg://postgres:postgres@localhost:5432/week_8` by default.

## Running

### Ingest the PDF into the vector store

```bash
uv run ingestor.py
```

This loads `docs/codigo-de-trabajo.pdf`, splits it into chunks of 1000 characters (with 200 overlap), generates embeddings with `text-embedding-3-large`, and stores them in the `codigo_de_trabajo_guatemala` collection.

### Query the vector store

```bash
uv run query.py
```

Runs a similarity search against the stored embeddings and prints the matching documents.
