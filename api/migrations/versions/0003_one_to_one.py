"""Persist simulated one-to-one meetings and their demo rewards."""
from alembic import op
import sqlalchemy as sa

revision = "0003_one_to_one"
down_revision = "0002_optional_activity_due_date"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "one_to_one_meetings",
        sa.Column("meeting_id", sa.String(), primary_key=True),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("manager_id", sa.String(), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("topic", sa.String(length=240), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("qualified", sa.Boolean(), nullable=False),
        sa.Column("qualifying_seconds", sa.Integer(), nullable=False),
        sa.Column("employee_confirmed", sa.Boolean(), nullable=False),
        sa.Column("manager_confirmed", sa.Boolean(), nullable=False),
        sa.Column("manager_present", sa.Boolean(), nullable=False),
        sa.Column("simulated_microphone_on", sa.Boolean(), nullable=False),
        sa.Column("accelerated", sa.Boolean(), nullable=False),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True)),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.String(), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("create_key", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("employee_id", "manager_id", "scheduled_at", name="uq_one_to_one_pair_time"),
        sa.UniqueConstraint("created_by", "create_key", name="uq_one_to_one_create_key"),
    )
    op.create_index("ix_one_to_one_meetings_employee_id", "one_to_one_meetings", ["employee_id"])
    op.create_index("ix_one_to_one_meetings_manager_id", "one_to_one_meetings", ["manager_id"])
    op.create_table(
        "one_to_one_rewards",
        sa.Column("reward_id", sa.String(), primary_key=True),
        sa.Column("meeting_id", sa.String(), sa.ForeignKey("one_to_one_meetings.meeting_id"), nullable=False),
        sa.Column("recipient_id", sa.String(), sa.ForeignKey("employees.employee_id"), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("meeting_id", "recipient_id", name="uq_one_to_one_reward_recipient"),
    )
    op.create_index("ix_one_to_one_rewards_meeting_id", "one_to_one_rewards", ["meeting_id"])
    op.create_index("ix_one_to_one_rewards_recipient_id", "one_to_one_rewards", ["recipient_id"])
    op.create_table(
        "one_to_one_commands",
        sa.Column("command_id", sa.String(), primary_key=True),
        sa.Column("meeting_id", sa.String(), sa.ForeignKey("one_to_one_meetings.meeting_id"), nullable=False),
        sa.Column("idempotency_key", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("meeting_id", "idempotency_key", name="uq_one_to_one_command_key"),
    )


def downgrade():
    op.drop_table("one_to_one_commands")
    op.drop_index("ix_one_to_one_rewards_recipient_id", table_name="one_to_one_rewards")
    op.drop_index("ix_one_to_one_rewards_meeting_id", table_name="one_to_one_rewards")
    op.drop_table("one_to_one_rewards")
    op.drop_index("ix_one_to_one_meetings_manager_id", table_name="one_to_one_meetings")
    op.drop_index("ix_one_to_one_meetings_employee_id", table_name="one_to_one_meetings")
    op.drop_table("one_to_one_meetings")
