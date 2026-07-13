"""
Import every model module here. Alembic's `env.py` imports `Base` from
`app.models.base` and relies on `Base.metadata` containing every table --
which only happens if each model module has actually been imported
somewhere. Centralizing that here means new model files only need one
line added, in one place, to be picked up by migrations.
"""
from app.models.base import Base  # noqa: F401

from app.models.user import (  # noqa: F401
    User,
    OAuthAccount,
    RefreshToken,
    PersonalAccessToken,
    SSHKey,
    EmailVerificationToken,
    PasswordResetToken,
)
from app.models.organization import (  # noqa: F401
    Organization,
    OrganizationMember,
    Team,
    TeamMember,
    TeamRepository,
)
from app.models.repo import (  # noqa: F401
    Repository,
    RepositoryCollaborator,
    Branch,
    RepositoryStar,
    RepositoryWatcher,
    Webhook,
)
from app.models.issue import (  # noqa: F401
    Label,
    Milestone,
    Issue,
    IssueLabel,
    IssueAssignee,
    IssueComment,
)
from app.models.pull_request import (  # noqa: F401
    PullRequest,
    PRReview,
    PRReviewComment,
    PRComment,
    AIReviewResult,
)
from app.models.discussion import Discussion, DiscussionComment  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.startup import (  # noqa: F401
    Startup,
    StartupMember,
    StartupOpenRole,
    StartupCollaborationRequest,
    StartupProject,
    StartupInvestor,
)

__all__ = [
    "Base",
    "User", "OAuthAccount", "RefreshToken", "PersonalAccessToken", "SSHKey",
    "EmailVerificationToken", "PasswordResetToken",
    "Organization", "OrganizationMember", "Team", "TeamMember", "TeamRepository",
    "Repository", "RepositoryCollaborator", "Branch", "RepositoryStar", "RepositoryWatcher", "Webhook",
    "Label", "Milestone", "Issue", "IssueLabel", "IssueAssignee", "IssueComment",
    "PullRequest", "PRReview", "PRReviewComment", "PRComment", "AIReviewResult",
    "Discussion", "DiscussionComment",
    "Notification",
    "AuditLog",
    "Startup", "StartupMember", "StartupOpenRole", "StartupCollaborationRequest",
    "StartupProject", "StartupInvestor",
]
