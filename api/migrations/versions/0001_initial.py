"""Initial Career Quest storage."""
from alembic import op
from app.models import Base
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    # Keep this revision frozen to the original schema. create_all() without an
    # explicit table list would silently create tables added by later revisions.
    initial_tables = [
        Base.metadata.tables[name]
        for name in (
            "dataset_state", "employees", "events", "skills", "role_profiles",
            "activity_history", "demo_sessions", "demo_clock",
        )
    ]
    Base.metadata.create_all(bind=op.get_bind(), tables=initial_tables)
def downgrade(): Base.metadata.drop_all(bind=op.get_bind())
