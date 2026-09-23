from functools import lru_cache

from fastembed import TextEmbedding

from app.config import EMBEDDING_DIMENSION, MODEL_CACHE, MODEL_NAME


@lru_cache(maxsize=1)
def model() -> TextEmbedding:
    return TextEmbedding(model_name=MODEL_NAME, cache_dir=MODEL_CACHE, threads=4)


def embed_passages(texts: list[str]) -> list:
    vectors = list(model().embed(texts, batch_size=16))
    if vectors and len(vectors[0]) != EMBEDDING_DIMENSION:
        raise RuntimeError(f"Model dimension {len(vectors[0])}; expected {EMBEDDING_DIMENSION}")
    return vectors


def embed_query(text: str):
    vector = next(iter(model().embed([text])))
    if len(vector) != EMBEDDING_DIMENSION:
        raise RuntimeError(f"Model dimension {len(vector)}; expected {EMBEDDING_DIMENSION}")
    return vector
