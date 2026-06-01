"""create auth_users table

Revision ID: 0002_create_auth_users
Revises: 0001_create_hr_field_defs
Create Date: 2026-06-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_create_auth_users"
down_revision = "0001_create_hr_field_defs"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=50), nullable=True),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("otp_code_hash", sa.String(length=255), nullable=True),
        sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("otp_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("role", "username", name="uq_auth_users_role_username"),
        sa.UniqueConstraint("email", name="uq_auth_users_email"),
    )


def downgrade():
    op.drop_table("auth_users")