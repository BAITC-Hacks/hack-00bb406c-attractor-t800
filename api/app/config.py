import os
from pathlib import Path
from urllib.parse import quote_plus

DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql+psycopg://{}:{}@{}/{}".format(
    quote_plus(os.environ.get("POSTGRES_USER", "career_quest")),
    quote_plus(os.environ.get("POSTGRES_PASSWORD", "career-quest-local")),
    os.environ.get("DATABASE_HOST", "localhost"),
    quote_plus(os.environ.get("POSTGRES_DB", "career_quest")),
)
SESSION_SECRET = os.environ.get("SESSION_SECRET", "local-demo-session-secret-change-me")
DATASET_PATH = Path(os.environ.get("DATASET_PATH", "../data/official"))
