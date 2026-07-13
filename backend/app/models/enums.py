"""
Centralized enum definitions.

Why Postgres native ENUM types (via SQLAlchemy Enum) instead of plain
VARCHAR + CHECK constraint: the database rejects invalid values at the
lowest possible layer (defense in depth — even a buggy raw SQL script or
another service can't insert 'pubic' instead of 'public'), and enums are
self-documenting in `\\d table` / psql introspection.

Trade-off acknowledged: adding a new enum value later requires an
`ALTER TYPE ... ADD VALUE` migration rather than just an app-code change.
For values that change frequently (e.g. notification types), we deliberately
use VARCHAR instead — see Notification.type below.
"""
import enum


class RepositoryVisibility(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    INTERNAL = "internal"  # visible to all authenticated users, not just members


class OwnerType(str, enum.Enum):
    USER = "user"
    ORGANIZATION = "organization"


class PermissionLevel(str, enum.Enum):
    READ = "read"
    TRIAGE = "triage"    # can manage issues/PRs but not push code
    WRITE = "write"
    MAINTAIN = "maintain"
    ADMIN = "admin"


class OrganizationRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class TeamRole(str, enum.Enum):
    MAINTAINER = "maintainer"
    MEMBER = "member"


class IssueState(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class PullRequestState(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    MERGED = "merged"


class ReviewState(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    COMMENTED = "commented"


class MilestoneState(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class DiscussionCategory(str, enum.Enum):
    GENERAL = "general"
    IDEAS = "ideas"
    QA = "qa"
    ANNOUNCEMENTS = "announcements"


class StartupStage(str, enum.Enum):
    IDEA = "idea"
    MVP = "mvp"
    EARLY_TRACTION = "early_traction"
    GROWTH = "growth"
    SCALING = "scaling"


class CollaborationRequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class OAuthProvider(str, enum.Enum):
    GITHUB = "github"
    GOOGLE = "google"
