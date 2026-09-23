"""Keep scenario completion time and real audit time separately."""
from alembic import op
import sqlalchemy as sa
revision = '0003_activity_completion'
down_revision = '0002_optional_activity_due_date'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('activity_history', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('activity_history', sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('activity_history', 'recorded_at')
    op.drop_column('activity_history', 'completed_at')
