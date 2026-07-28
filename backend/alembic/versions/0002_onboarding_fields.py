"""Add onboarding and education fields to users table

Revision ID: 0002_onboarding_fields
Revises: 0001_baseline_schema
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_onboarding_fields"
down_revision = "0001_baseline_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("institution", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("degree", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("field_of_study", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("graduation_year", sa.Integer(), nullable=True))
    op.add_column(
        "users",
        sa.Column("needs_onboarding", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "needs_onboarding")
    op.drop_column("users", "graduation_year")
    op.drop_column("users", "field_of_study")
    op.drop_column("users", "degree")
    op.drop_column("users", "institution")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
