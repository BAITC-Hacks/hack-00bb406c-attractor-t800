"""Immutable approved work plans and employee proposals."""
from alembic import op
from app.models import WorkGoal, WorkPlan
revision = '0004_work_goals'
down_revision = '0003_activity_completion'
branch_labels = None
depends_on = None


def upgrade():
    WorkGoal.__table__.create(op.get_bind())
    WorkPlan.__table__.create(op.get_bind())


def downgrade():
    WorkPlan.__table__.drop(op.get_bind())
    WorkGoal.__table__.drop(op.get_bind())
