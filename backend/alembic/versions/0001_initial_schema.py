"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- users --
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(39), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100)),
        sa.Column("bio", sa.Text),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("website", sa.String(255)),
        sa.Column("location", sa.String(100)),
        sa.Column("company", sa.String(100)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("role", sa.String(10), nullable=False, server_default="user"),
        sa.Column("totp_secret", sa.String(32)),
        sa.Column("totp_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # -- organizations --
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("website", sa.String(255)),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])

    # -- organization_members --
    op.create_table(
        "organization_members",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("org_id", sa.Integer, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("org_id", "user_id", name="uq_org_member"),
    )

    # -- repositories --
    op.create_table(
        "repositories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("org_id", sa.Integer, sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("visibility", sa.String(10), nullable=False, server_default="public"),
        sa.Column("default_branch", sa.String(100), nullable=False, server_default="main"),
        sa.Column("star_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("fork_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("open_issues_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("watcher_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_fork", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("forked_from_id", sa.Integer, sa.ForeignKey("repositories.id", ondelete="SET NULL")),
        sa.Column("disk_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("pushed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_repo_owner_name", "repositories", ["owner_id", "name"], unique=True)
    op.create_index("ix_repositories_slug", "repositories", ["slug"])

    # -- stars --
    op.create_table(
        "stars",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("repository_id", sa.Integer, sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", "repository_id", name="uq_star"),
    )

    # -- follows --
    op.create_table(
        "follows",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("follower_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("followee_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("follower_id", "followee_id", name="uq_follow"),
    )

    # -- issues --
    op.create_table(
        "issues",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("repository_id", sa.Integer, sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignee_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("number", sa.Integer, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text),
        sa.Column("state", sa.String(10), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(10)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_issues_repository_id", "issues", ["repository_id"])

    # -- issue_comments --
    op.create_table(
        "issue_comments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("issue_id", sa.Integer, sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("issue_comments")
    op.drop_table("issues")
    op.drop_table("follows")
    op.drop_table("stars")
    op.drop_table("repositories")
    op.drop_table("organization_members")
    op.drop_table("organizations")
    op.drop_table("users")
