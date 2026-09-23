from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from pgvector.psycopg import register_vector

from app.config import DATABASE_URL


SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS sources (
    namespace text NOT NULL,
    source_id text NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_version text NOT NULL DEFAULT '1',
    effective_from timestamptz,
    effective_to timestamptz,
    content_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (namespace, source_id)
);
CREATE TABLE IF NOT EXISTS chunks (
    namespace text NOT NULL,
    source_id text NOT NULL,
    chunk_index integer NOT NULL,
    section text NOT NULL DEFAULT '',
    content text NOT NULL,
    embedding vector(384) NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
    PRIMARY KEY (namespace, source_id, chunk_index),
    FOREIGN KEY (namespace, source_id) REFERENCES sources(namespace, source_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tsv_gin ON chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS sources_kind ON sources (namespace, kind);
CREATE INDEX IF NOT EXISTS sources_metadata_gin ON sources USING gin (metadata jsonb_path_ops);
"""


def initialize() -> None:
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        conn.execute(SCHEMA)


@contextmanager
def connection():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        register_vector(conn)
        yield conn
