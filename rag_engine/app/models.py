from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class Document(BaseModel):
    namespace: str = Field(min_length=1, max_length=100)
    source_id: str = Field(min_length=1, max_length=200)
    kind: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=200_000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    source_version: str = Field(default="1", max_length=100)
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class DocumentBatch(BaseModel):
    documents: list[Document] = Field(min_length=1, max_length=100)


class SearchRequest(BaseModel):
    namespace: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=2000)
    kinds: list[str] | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    as_of: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    limit: int = Field(default=8, ge=1, le=50)
    mode: Literal["hybrid", "semantic", "lexical"] = "hybrid"


class ContextRequest(SearchRequest):
    max_chars: int = Field(default=6000, ge=200, le=30000)


class LookupRequest(BaseModel):
    namespace: str = Field(min_length=1, max_length=100)
    kinds: list[str] | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    cursor: str | None = None
    limit: int = Field(default=50, ge=1, le=500)
