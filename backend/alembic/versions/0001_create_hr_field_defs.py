"""create hr_field_defs table

Revision ID: 0001_create_hr_field_defs
Revises: 
Create Date: 2026-05-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_create_hr_field_defs'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'hr_field_defs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('label', sa.String(length=255), nullable=False),
        sa.Column('data_type', sa.String(length=50), nullable=False, server_default='string'),
        sa.Column('sort_order', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('hr_field_defs')
