from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Security
from fastapi.security import APIKeyHeader
from psycopg.errors import OperationalError
from psycopg.types.json import Jsonb

from app.config import API_KEY, MODEL_NAME
from app.db import connection, initialize
from app.models import ContextRequest, Document, DocumentBatch, LookupRequest, SearchRequest
from app.store import search, upsert


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize()
    yield


app = FastAPI(title="Career Quest RAG Engine", version="0.1.0", lifespan=lifespan)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_key(provided: Annotated[str | None, Security(api_key_header)]) -> None:
    import secrets

    if not provided or not secrets.compare_digest(provided, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


Protected = Annotated[None, Depends(require_key)]


@app.get("/health/live")
def live():
    return {"status": "alive"}


@app.get("/health/ready")
def ready():
    try:
        with connection() as conn:
            conn.execute("SELECT 1")
        return {"status": "ready", "embedding_model": MODEL_NAME}
    except OperationalError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc


@app.put("/v1/documents")
def put_document(document: Document, _: Protected):
    if document.effective_from and document.effective_to and document.effective_to <= document.effective_from:
        raise HTTPException(status_code=422, detail="effective_to must be after effective_from")
    with connection() as conn:
        return upsert(conn, document)


@app.post("/v1/documents/batch")
def put_batch(batch: DocumentBatch, _: Protected):
    for document in batch.documents:
        if document.effective_from and document.effective_to and document.effective_to <= document.effective_from:
            raise HTTPException(status_code=422, detail=f"Invalid effective dates: {document.source_id}")
    with connection() as conn:
        results = [upsert(conn, document) for document in batch.documents]
    return {"total": len(results), "changed": sum(bool(row["changed"]) for row in results), "results": results}


def _get_document(source_id: str, namespace: str):
    with connection() as conn:
        row = conn.execute("SELECT * FROM sources WHERE namespace=%s AND source_id=%s", (namespace, source_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return row


def _delete_document(source_id: str, namespace: str):
    with connection() as conn:
        deleted = conn.execute(
            "DELETE FROM sources WHERE namespace=%s AND source_id=%s RETURNING source_id",
            (namespace, source_id),
        ).fetchone()
    return {"source_id": source_id, "deleted": bool(deleted)}


@app.get("/v1/documents")
def get_document_by_query(_: Protected, namespace: str = Query(min_length=1), source_id: str = Query(min_length=1)):
    return _get_document(source_id, namespace)


@app.delete("/v1/documents")
def delete_document_by_query(_: Protected, namespace: str = Query(min_length=1), source_id: str = Query(min_length=1)):
    return _delete_document(source_id, namespace)


@app.get("/v1/documents/{source_id}")
def get_document(source_id: str, _: Protected, namespace: str = Query(min_length=1)):
    return _get_document(source_id, namespace)


@app.delete("/v1/documents/{source_id}")
def delete_document(source_id: str, _: Protected, namespace: str = Query(min_length=1)):
    return _delete_document(source_id, namespace)


@app.post("/v1/lookup")
def lookup(request: LookupRequest, _: Protected):
    with connection() as conn:
        rows = conn.execute(
            """SELECT source_id, kind, title, body AS content, metadata, source_version,
                      effective_from, effective_to, updated_at
               FROM sources
               WHERE namespace=%(namespace)s
                 AND (%(kinds)s::text[] IS NULL OR kind = ANY(%(kinds)s::text[]))
                 AND metadata @> %(filters)s
                 AND (%(cursor)s::text IS NULL OR source_id > %(cursor)s)
               ORDER BY source_id LIMIT %(limit)s""",
            {"namespace": request.namespace, "kinds": request.kinds,
             "filters": Jsonb(request.filters),
             "cursor": request.cursor, "limit": request.limit},
        ).fetchall()
    return {"namespace": request.namespace, "results": rows,
            "next_cursor": rows[-1]["source_id"] if len(rows) == request.limit else None}


@app.post("/v1/search")
def search_documents(request: SearchRequest, _: Protected):
    with connection() as conn:
        results = search(conn, request)
    return {"query": request.query, "namespace": request.namespace, "results": results}


@app.post("/v1/context")
def build_context(request: ContextRequest, _: Protected):
    with connection() as conn:
        results = search(conn, request)
    parts, citations, used = [], [], 0
    for result in results:
        header = f"[{result['citation_id']}] {result['title']} (версия {result['source_version']})\n"
        passage = header + result["content"]
        if used + len(passage) > request.max_chars:
            if not parts:
                passage = passage[:request.max_chars]
            else:
                break
        parts.append(passage)
        citations.append({key: result[key] for key in ("citation_id", "source_id", "chunk_index", "title", "source_version", "metadata")})
        used += len(passage)
    return {"context": "\n\n".join(parts), "citations": citations, "query": request.query}


@app.get("/v1/stats")
def stats(_: Protected, namespace: str = Query(min_length=1)):
    with connection() as conn:
        rows = conn.execute(
            """SELECT s.kind, count(DISTINCT s.source_id) AS sources, count(c.chunk_index) AS chunks,
                      max(s.updated_at) AS latest_update
               FROM sources s LEFT JOIN chunks c USING (namespace, source_id)
               WHERE s.namespace=%s GROUP BY s.kind ORDER BY s.kind""",
            (namespace,),
        ).fetchall()
    return {"namespace": namespace, "kinds": rows, "as_of": datetime.now(timezone.utc)}
