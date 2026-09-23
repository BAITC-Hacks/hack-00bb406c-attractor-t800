"""Allow voluntary activity records without a due date."""
from alembic import op
import sqlalchemy as sa

revision = "0002_optional_activity_due_date"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column("activity_history", "due_date", existing_type=sa.Date(), nullable=True)

def downgrade():
    # Historical voluntary records legitimately have no due date, so narrowing
    # this column again would lose compatibility with the official dataset.
    pass
