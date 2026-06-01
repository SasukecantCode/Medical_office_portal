"""create auth_invites table

Revision ID: 0003_create_auth_invites
Revises: 0002_create_auth_users
Create Date: 2026-06-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_create_auth_invites"
down_revision = "0002_create_auth_users"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_invites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("token_preview", sa.String(length=32), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("redeemed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("auth_invites")