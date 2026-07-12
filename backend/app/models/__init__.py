# Import all models here so Alembic autogenerate can discover them
from app.db.base import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.organization import Organization, OrganizationMember  # noqa: F401
from app.models.repository import Repository  # noqa: F401
from app.models.star import Star, Follow  # noqa: F401
from app.models.issue import Issue, IssueComment  # noqa: F401

__all__ = [
    "Base",
    "User",
    "Organization",
    "OrganizationMember",
    "Repository",
    "Star",
    "Follow",
    "Issue",
    "IssueComment",
]
