"""Evidence packages and globally unique confirmed records."""
from alembic import op
from app.models import WorkResult, ConfirmedRecord
revision = '0005_work_results'
down_revision = '0004_work_goals'
branch_labels = None
depends_on = None


def upgrade():
    WorkResult.__table__.create(op.get_bind())
    ConfirmedRecord.__table__.create(op.get_bind())


def downgrade():
    ConfirmedRecord.__table__.drop(op.get_bind())
    WorkResult.__table__.drop(op.get_bind())
