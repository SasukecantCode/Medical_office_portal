"""create admin_access_logs table

Revision ID: 0004_create_admin_access_logs
Revises: 0003_create_auth_invites
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_create_admin_access_logs"
down_revision = "0003_create_auth_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_access_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("invite_id", sa.Integer(), nullable=True),
        sa.Column("profile_handle", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("logged_in_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_admin_access_logs_user_id", "admin_access_logs", ["user_id"])
    op.create_index("ix_admin_access_logs_invite_id", "admin_access_logs", ["invite_id"])
    op.create_index("ix_admin_access_logs_role", "admin_access_logs", ["role"])
    op.create_index("ix_admin_access_logs_logged_in_at", "admin_access_logs", ["logged_in_at"])


def downgrade() -> None:
    op.drop_table("admin_access_logs")
