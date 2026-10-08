"""Add hybrid routing provenance columns to ai_review_results

Adds four columns to `ai_review_results` to store the output of the
Dynamic Hybrid Expert Routing pipeline (Module 11):

  diff_category    — semantic category assigned by the classifier
                     (functional | refactoring | documentation |
                      discussion | false_positive)
  severity         — majority-vote severity across k expert samples
                     (low | medium | high | critical)
  k_samples        — number of successful expert model calls
  routing_metadata — full provenance JSON (model, k, votes, etc.)

All columns have safe server-defaults so existing rows are not broken.

Revision ID: 0003_ai_routing_provenance
Revises: 0002_onboarding_fields
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_ai_routing_provenance"
down_revision = "c4e9f2a71b35"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_review_results",
        sa.Column(
            "diff_category",
            sa.String(50),
            nullable=False,
            server_default="functional",
        ),
    )
    op.add_column(
        "ai_review_results",
        sa.Column(
            "severity",
            sa.String(20),
            nullable=False,
            server_default="medium",
        ),
    )
    op.add_column(
        "ai_review_results",
        sa.Column(
            "k_samples",
            sa.SmallInteger(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "ai_review_results",
        sa.Column(
            "routing_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    # Widen model_used to accommodate full OpenRouter model IDs
    # (e.g. "qwen/qwen-2.5-coder-32b-instruct" is 40+ chars)
    op.alter_column(
        "ai_review_results",
        "model_used",
        existing_type=sa.String(100),
        type_=sa.String(200),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "ai_review_results",
        "model_used",
        existing_type=sa.String(200),
        type_=sa.String(100),
        existing_nullable=False,
    )
    op.drop_column("ai_review_results", "routing_metadata")
    op.drop_column("ai_review_results", "k_samples")
    op.drop_column("ai_review_results", "severity")
    op.drop_column("ai_review_results", "diff_category")
