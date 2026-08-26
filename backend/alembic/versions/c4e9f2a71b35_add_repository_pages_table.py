"""add repository_pages table

Revision ID: c4e9f2a71b35
Revises: 11222b321470
Create Date: 2026-08-26 12:20:00.000000

Adds the repository_pages table which powers PandaHub Pages —
static-site hosting directly from a git repository branch.

One row per repository (enforced by UniqueConstraint on repository_id).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c4e9f2a71b35'
down_revision = '11222b321470'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'repository_pages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            'repository_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('repositories.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('source_branch', sa.String(255), nullable=False, server_default='main'),
        sa.Column('source_folder', sa.String(500), nullable=False, server_default='/'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('published_sha', sa.String(40), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('custom_domain', sa.String(253), nullable=True),
        # Timestamps
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )

    # Index on repository_id for fast lookup by repo
    op.create_index(
        'ix_repository_pages_repository_id',
        'repository_pages',
        ['repository_id'],
    )

    # Unique constraint: one Pages config per repository
    op.create_unique_constraint(
        'uq_repository_pages_repo',
        'repository_pages',
        ['repository_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_repository_pages_repository_id', table_name='repository_pages')
    op.drop_table('repository_pages')
