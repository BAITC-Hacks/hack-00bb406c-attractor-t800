import hashlib
import json

from psycopg.types.json import Jsonb

from app.chunking import split_text
from app.config import MODEL_NAME
from app.embedding import embed_passages, embed_query
from app.models import Document, SearchRequest


def _fingerprint(doc: Document) -> str:
    payload = doc.model_dump(mode="json") | {"embedding_model": MODEL_NAME}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def upsert(conn, doc: Document) -> dict:
    digest = _fingerprint(doc)
    old = conn.execute(
        "SELECT content_hash FROM sources WHERE namespace=%s AND source_id=%s",
        (doc.namespace, doc.source_id),
    ).fetchone()
    if old and old["content_hash"] == digest:
        return {"source_id": doc.source_id, "changed": False}

    chunks = split_text(doc.content)
    if not chunks:
        raise ValueError("Content has no searchable words")
    vectors = embed_passages([(doc.title + " " + section + " " + body).strip() for section, body in chunks])
    with conn.transaction():
        conn.execute(
            """INSERT INTO sources
               (namespace, source_id, kind, title, body, metadata, source_version,
                effective_from, effective_to, content_hash)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (namespace, source_id) DO UPDATE SET
                kind=EXCLUDED.kind, title=EXCLUDED.title, body=EXCLUDED.body,
                metadata=EXCLUDED.metadata, source_version=EXCLUDED.source_version,
                effective_from=EXCLUDED.effective_from, effective_to=EXCLUDED.effective_to,
                content_hash=EXCLUDED.content_hash, updated_at=now()""",
            (doc.namespace, doc.source_id, doc.kind, doc.title, doc.content,
             Jsonb(doc.metadata), doc.source_version, doc.effective_from,
             doc.effective_to, digest),
        )
        conn.execute("DELETE FROM chunks WHERE namespace=%s AND source_id=%s", (doc.namespace, doc.source_id))
        with conn.cursor() as cur:
            for index, ((section, body), vector) in enumerate(zip(chunks, vectors, strict=True)):
                cur.execute(
                    "INSERT INTO chunks (namespace, source_id, chunk_index, section, content, embedding) VALUES (%s,%s,%s,%s,%s,%s)",
                    (doc.namespace, doc.source_id, index, section, body, vector),
                )
    return {"source_id": doc.source_id, "changed": True, "chunks": len(chunks)}


def search(conn, request: SearchRequest) -> list[dict]:
    candidate_limit = max(60, request.limit * 6)
    common = {
        "namespace": request.namespace,
        "kinds": request.kinds,
        "filters": Jsonb(request.filters),
        "as_of": request.as_of,
        "limit": candidate_limit,
    }
    where = """s.namespace = %(namespace)s
        AND (%(kinds)s::text[] IS NULL OR s.kind = ANY(%(kinds)s::text[]))
        AND s.metadata @> %(filters)s
        AND (s.effective_from IS NULL OR s.effective_from <= %(as_of)s)
        AND (s.effective_to IS NULL OR s.effective_to > %(as_of)s)"""
    select = """SELECT c.source_id, c.chunk_index, c.section, c.content,
        s.kind, s.title, s.source_version, s.metadata, s.updated_at,
        s.effective_from, s.effective_to"""
    joins = " FROM chunks c JOIN sources s USING (namespace, source_id) WHERE " + where
    ranks: dict[tuple[str, int], dict] = {}

    if request.mode in ("hybrid", "semantic"):
        vector = embed_query(request.query)
        conn.execute("SET LOCAL hnsw.iterative_scan = strict_order")
        rows = conn.execute(
            select + ", 1 - (c.embedding <=> %(vector)s) AS similarity" + joins
            + " ORDER BY c.embedding <=> %(vector)s LIMIT %(limit)s",
            common | {"vector": vector},
        ).fetchall()
        for rank, row in enumerate(rows, 1):
            key = (row["source_id"], row["chunk_index"])
            ranks[key] = {"row": row, "score": 1.0 / (60 + rank), "channels": ["semantic"]}

    if request.mode in ("hybrid", "lexical"):
        rows = conn.execute(
            select + ", ts_rank_cd(c.tsv, plainto_tsquery('simple', %(query)s)) AS lexical_score"
            + joins + " AND c.tsv @@ plainto_tsquery('simple', %(query)s)"
            + " ORDER BY lexical_score DESC LIMIT %(limit)s",
            common | {"query": request.query},
        ).fetchall()
        for rank, row in enumerate(rows, 1):
            key = (row["source_id"], row["chunk_index"])
            if key in ranks:
                ranks[key]["score"] += 1.0 / (60 + rank)
                ranks[key]["channels"].append("lexical")
            else:
                ranks[key] = {"row": row, "score": 1.0 / (60 + rank), "channels": ["lexical"]}

    result = []
    for item in sorted(ranks.values(), key=lambda v: (-v["score"], v["row"]["source_id"], v["row"]["chunk_index"]))[:request.limit]:
        row = item["row"]
        result.append({
            "citation_id": f"{request.namespace}/{row['source_id']}#{row['chunk_index']}",
            "source_id": row["source_id"], "chunk_index": row["chunk_index"],
            "kind": row["kind"], "title": row["title"], "section": row["section"],
            "content": row["content"], "metadata": row["metadata"],
            "source_version": row["source_version"], "updated_at": row["updated_at"],
            "effective_from": row["effective_from"], "effective_to": row["effective_to"],
            "score": round(item["score"], 6), "matched_by": item["channels"],
        })
    return result
