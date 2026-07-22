"""
git_engine.reader — Architecture alias module.

The actual read implementation lives in ``app.services.git_service``
(pygit2 wrappers for branches, tree, blob, commits, README).  This module
re-exports everything from there so code that follows the architecture
diagram and imports from ``app.git_engine.reader`` works identically.

Why the split?  ``services/git_service.py`` is a service-layer module with
async wrappers.  ``git_engine/`` is the low-level engine layer.  In practice
the boundary between "service wrapper" and "engine" is thin for read-only
operations, so we keep the real implementation in the service layer (where
it can be injected/tested easily) and expose it here as well.
"""
from app.services.git_service import (  # noqa: F401
    get_blob,
    get_commits,
    get_readme,
    get_tree,
    list_branches,
)

__all__ = [
    "list_branches",
    "get_tree",
    "get_blob",
    "get_commits",
    "get_readme",
]
