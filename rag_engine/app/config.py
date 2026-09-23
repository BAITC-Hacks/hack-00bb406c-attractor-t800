import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://rag:local-rag-change-me@localhost:5432/rag")
API_KEY = os.environ.get("RAG_API_KEY", "local-rag-api-key-change-me")
MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
MODEL_CACHE = os.environ.get("FASTEMBED_CACHE_PATH", "/models")
DATASET_DIR = os.environ.get("DATASET_DIR", "/dataset")
EMBEDDING_DIMENSION = 384
