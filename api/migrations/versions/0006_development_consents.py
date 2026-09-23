"""Separate development disclosure consents, disabled by default."""
from alembic import op
from app.development_consents import DevelopmentConsent
revision = '0006_development_consents'
down_revision = '0005_work_results'
branch_labels = None
depends_on = None


def upgrade():
    DevelopmentConsent.__table__.create(op.get_bind())


def downgrade():
    DevelopmentConsent.__table__.drop(op.get_bind())
