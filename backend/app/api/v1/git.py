"""
Smart-HTTP Git transport — Module 8.

Implements the git smart-HTTP protocol by delegating all pack-protocol I/O
to the ``git http-backend`` CGI program that ships with git itself.  FastAPI:
  1. Authenticates the request (Bearer JWT or Basic PAT)
  2. Resolves the repository and checks permissions
  3. Spawns ``git http-backend`` as a subprocess
  4. Streams the subprocess's stdout directly to the HTTP response
  5. On receive-pack completion, fires the post-receive Celery task

URL layout (matches nginx ``/git/`` routing block):

  GET  /git/{owner}/{repo}.git/info/refs
       ?service=git-upload-pack   →  clone/fetch handshake   (READ)
       ?service=git-receive-pack  →  push handshake          (WRITE)

  POST /git/{owner}/{repo}.git/git-upload-pack               (READ)
  POST /git/{owner}/{repo}.git/git-receive-pack              (WRITE)

Why ``git http-backend`` and not a pure-Python implementation?
  The git pack protocol is a complex binary wire format (pack-line framing,
  delta compression, sideband multiplexing).  ``git http-backend`` is the
  C reference implementation, battle-tested at GitHub/GitLab scale, and is
  already installed in the backend Docker image (``apt-get install git``).
  Our job is auth + permission gating + subprocess orchestration, not
  reimplementing the pack protocol.

Streaming design:
  Both clone and push can transfer hundreds of megabytes.  We use
  ``asyncio.create_subprocess_exec`` + ``StreamingResponse`` to pipe
  subprocess stdout directly to the client without buffering the entire
  pack file in memory.  The nginx config already sets
  ``proxy_request_buffering off`` and ``proxy_read_timeout 3600s`` to
  support long-lived transfer connections.
"""
from __future__ import annotations

import asyncio
import os
from typing import AsyncGenerator, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, PermissionDeniedError, UnauthorizedError
from app.core.logging import get_logger
from app.db.session import get_db
from app.git_engine.auth import authenticate_git_request, make_www_authenticate_header
from app.models.enums import PermissionLevel
from app.models.repo import Repository
from app.models.user import User
from app.permissions.resolver import resolve_permission
from app.schemas.git_schema import GitServiceType
from app.services.repo_service import get_repo_by_owner_and_name

settings = get_settings()
logger = get_logger("app.api.v1.git")

router = APIRouter(tags=["git-transport"])

# git http-backend binary — present in the Docker image via ``apt-get install git``
_GIT_HTTP_BACKEND = "git-http-backend"

# Content-Type header values used by the git smart-HTTP protocol
_CT_UPLOAD_PACK_REQ = "application/x-git-upload-pack-request"
_CT_UPLOAD_PACK_RES = "application/x-git-upload-pack-result"
_CT_RECEIVE_PACK_REQ = "application/x-git-receive-pack-request"
_CT_RECEIVE_PACK_RES = "application/x-git-receive-pack-result"
_CT_INFO_REFS = "application/x-git-{service}-advertisement"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _repo_path_info(repo: Repository, suffix: str) -> str:
    """
    Build the ``PATH_INFO`` env var for ``git http-backend``.

    ``git http-backend`` expects a path relative to ``GIT_PROJECT_ROOT``.
    Since our disk paths are ``/data/repositories/<uuid>.git``, and
    GIT_PROJECT_ROOT is ``/data/repositories``, the PATH_INFO is just
    ``/<uuid>.git/<suffix>``.

    Args:
        repo:   The Repository ORM object.
        suffix: The URL suffix after the .git part, e.g. ``/info/refs``.
    """
    repo_dir = Path(repo.disk_path).name  # e.g. "550e8400-...-.git"
    return f"/{repo_dir}{suffix}"


def _build_env(
    request: Request,
    repo: Repository,
    path_suffix: str,
    user: Optional[User],
) -> dict[str, str]:
    """
    Build the CGI-style environment dict for ``git http-backend``.

    ``git http-backend`` reads its configuration exclusively from environment
    variables (it's a CGI program).  We set the minimum required set.

    Args:
        request:     The incoming HTTP request.
        repo:        The target repository.
        path_suffix: URL suffix after ``.git``, e.g. ``/info/refs``.
        user:        The authenticated user (or None for anonymous).
    """
    env = {
        # Core CGI variables
        "REQUEST_METHOD": request.method,
        "QUERY_STRING": str(request.url.query),
        "CONTENT_TYPE": request.headers.get("Content-Type", ""),
        "PATH_INFO": _repo_path_info(repo, path_suffix),

        # git http-backend specific
        "GIT_PROJECT_ROOT": settings.GIT_REPOS_ROOT,
        # Export ALL repos — we've already done auth/permission gating above.
        # Without this, git http-backend checks for a git-daemon-export-ok file.
        "GIT_HTTP_EXPORT_ALL": "1",

        # Pass through the real client IP for git's access logs
        "REMOTE_ADDR": request.client.host if request.client else "127.0.0.1",

        # Populate REMOTE_USER for audit logging inside git http-backend
        "REMOTE_USER": user.username if user else "",

        # Inherit PATH so git can find its own sub-commands
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),

        # Prevent git from trying to use a home directory config that may
        # not exist (running as non-root in Docker)
        "HOME": "/tmp",
        "GIT_CONFIG_NOSYSTEM": "1",
    }

    # Content-Length is required for POST requests
    content_length = request.headers.get("Content-Length")
    if content_length:
        env["CONTENT_LENGTH"] = content_length

    return env


async def _stream_git_backend(
    request: Request,
    repo: Repository,
    path_suffix: str,
    user: Optional[User],
) -> tuple[int, dict[str, str], AsyncGenerator[bytes, None]]:
    """
    Spawn ``git http-backend``, feed it the request body, and return a
    streaming generator that yields the subprocess stdout.

    Returns:
        A ``(status_code, headers, body_generator)`` tuple.  The caller
        wraps this in a ``StreamingResponse``.

    Raises:
        AppError: If the subprocess fails to start or exits with an error.
    """
    env = _build_env(request, repo, path_suffix, user)

    proc = await asyncio.create_subprocess_exec(
        _GIT_HTTP_BACKEND,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    # Feed the request body to git http-backend stdin in a background task
    # so we can simultaneously start reading stdout (avoids a deadlock on
    # large pushes where both stdin and stdout buffers fill simultaneously).
    request_body = await request.body()
    stdin_task = asyncio.create_task(_write_stdin(proc, request_body))

    # Read the CGI response headers from stdout (terminated by blank line).
    raw_headers, header_end_pos = await _read_cgi_headers(proc.stdout)

    # Parse status and headers from the CGI response
    response_status = 200
    response_headers: dict[str, str] = {}
    for line in raw_headers.splitlines():
        if line.lower().startswith("status:"):
            try:
                response_status = int(line.split(":", 1)[1].strip().split()[0])
            except (ValueError, IndexError):
                pass
        elif ":" in line:
            key, _, val = line.partition(":")
            response_headers[key.strip()] = val.strip()

    # Create a generator that streams the remaining stdout
    async def _body_generator() -> AsyncGenerator[bytes, None]:
        try:
            while True:
                chunk = await proc.stdout.read(65536)  # 64 KB chunks
                if not chunk:
                    break
                yield chunk
        finally:
            await stdin_task
            await proc.wait()

    return response_status, response_headers, _body_generator()


async def _write_stdin(proc: asyncio.subprocess.Process, body: bytes) -> None:
    """Write request body to subprocess stdin, then close it."""
    if body:
        proc.stdin.write(body)
    await proc.stdin.drain()
    proc.stdin.close()


async def _read_cgi_headers(stdout: asyncio.StreamReader) -> tuple[str, int]:
    """
    Read CGI response headers from stdout up to the blank line separator.

    CGI programs output headers followed by a blank line, then the body.
    We read byte-by-byte until we find ``\\r\\n\\r\\n`` or ``\\n\\n``.
    """
    header_bytes = b""
    while True:
        line = await stdout.readline()
        if not line:
            break
        header_bytes += line
        # Blank line marks end of headers
        if line in (b"\r\n", b"\n"):
            break
    return header_bytes.decode("utf-8", errors="replace"), len(header_bytes)


def _require_401(realm: str = "PandaHub") -> Response:
    """Return a 401 response that prompts git clients to send credentials."""
    return Response(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": make_www_authenticate_header(realm)},
        content="Authentication required",
    )


async def _resolve_and_check(
    owner: str,
    repo_name: str,
    db: AsyncSession,
    user: Optional[User],
    required_level: PermissionLevel,
) -> Repository:
    """
    Resolve (owner, repo_name) → Repository and verify the user has
    *required_level* access.  Raises appropriate HTTP-mapped errors.

    Returns the Repository ORM object.
    """
    repo = await get_repo_by_owner_and_name(db, owner, repo_name)
    if repo is None:
        # Return 404 even for private repos — don't leak existence.
        raise NotFoundError(f"Repository '{owner}/{repo_name}' not found.")

    resolved = await resolve_permission(
        db, user.id if user else None, repo
    )

    from app.permissions.resolver import _meets_minimum
    if not _meets_minimum(resolved, required_level):
        if user is None:
            # Anonymous caller — trigger credential prompt
            raise UnauthorizedError(
                f"Authentication required to access '{owner}/{repo_name}'."
            )
        raise PermissionDeniedError(
            f"You do not have '{required_level.value}' permission on "
            f"'{repo_name}'."
        )

    return repo


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "/git/{owner}/{repo_name}.git/info/refs",
    summary="Git smart-HTTP info/refs (clone/fetch/push handshake)",
    include_in_schema=False,  # git-protocol endpoints are internal; hide from Swagger
)
async def info_refs(
    owner: str,
    repo_name: str,
    service: str = Query(..., alias="service"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Handles both upload-pack (clone/fetch) and receive-pack (push) handshakes.

    The git client sends a single ``?service=git-{upload,receive}-pack``
    query parameter.  We dispatch based on that value and gate permissions
    accordingly.
    """
    user = await authenticate_git_request(request, db)

    try:
        service_type = GitServiceType(service)
    except ValueError:
        return Response(
            status_code=status.HTTP_403_FORBIDDEN,
            content=f"Unsupported git service: {service}",
        )

    # Permission: upload-pack needs READ, receive-pack needs WRITE
    required = (
        PermissionLevel.READ
        if service_type == GitServiceType.UPLOAD_PACK
        else PermissionLevel.WRITE
    )

    try:
        repo = await _resolve_and_check(owner, repo_name, db, user, required)
    except UnauthorizedError:
        return _require_401()

    status_code, headers, body = await _stream_git_backend(
        request, repo, "/info/refs", user
    )

    # Override Content-Type to the git-specific advertisement type
    headers["Content-Type"] = _CT_INFO_REFS.format(service=service)
    # Disable caching — git clients should always get fresh ref lists
    headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
    headers["Pragma"] = "no-cache"

    return StreamingResponse(
        content=body,
        status_code=status_code,
        headers=headers,
        media_type=headers.get("Content-Type"),
    )


@router.post(
    "/git/{owner}/{repo_name}.git/git-upload-pack",
    summary="Git smart-HTTP upload-pack (clone/fetch data)",
    include_in_schema=False,
)
async def upload_pack(
    owner: str,
    repo_name: str,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Serves the pack data for clone and fetch operations.

    Permission: READ (public repos: anonymous ok; private: auth required).
    """
    user = await authenticate_git_request(request, db)

    try:
        repo = await _resolve_and_check(
            owner, repo_name, db, user, PermissionLevel.READ
        )
    except UnauthorizedError:
        return _require_401()

    if request.headers.get("Content-Type") != _CT_UPLOAD_PACK_REQ:
        return Response(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            content="Expected application/x-git-upload-pack-request",
        )

    status_code, headers, body = await _stream_git_backend(
        request, repo, "/git-upload-pack", user
    )
    headers["Content-Type"] = _CT_UPLOAD_PACK_RES

    return StreamingResponse(
        content=body,
        status_code=status_code,
        headers=headers,
        media_type=_CT_UPLOAD_PACK_RES,
    )


@router.post(
    "/git/{owner}/{repo_name}.git/git-receive-pack",
    summary="Git smart-HTTP receive-pack (push data)",
    include_in_schema=False,
)
async def receive_pack(
    owner: str,
    repo_name: str,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Accepts pushed pack data and writes it to the bare repository.

    Permission: WRITE (always requires auth — anonymous push is never allowed).

    After the push completes, fires the ``post_receive_hook`` Celery task
    which syncs the Branch cache, updates repo size, and fires webhooks.
    """
    user = await authenticate_git_request(request, db)

    if user is None:
        # Push always requires auth — don't even try anonymous
        return _require_401()

    try:
        repo = await _resolve_and_check(
            owner, repo_name, db, user, PermissionLevel.WRITE
        )
    except (UnauthorizedError, PermissionDeniedError) as exc:
        if isinstance(exc, UnauthorizedError):
            return _require_401()
        return Response(
            status_code=status.HTTP_403_FORBIDDEN,
            content=str(exc.message),
        )

    if request.headers.get("Content-Type") != _CT_RECEIVE_PACK_REQ:
        return Response(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            content="Expected application/x-git-receive-pack-request",
        )

    # Capture stderr to extract the pushed-ref list for the post-receive hook
    # We need a custom subprocess here (not _stream_git_backend) to capture stderr
    env = _build_env(request, repo, "/git-receive-pack", user)
    request_body = await request.body()

    proc = await asyncio.create_subprocess_exec(
        _GIT_HTTP_BACKEND,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    # Write request body to stdin
    stdout_data, stderr_data = await proc.communicate(input=request_body)
    return_code = proc.returncode

    if return_code != 0:
        logger.error(
            "git-receive-pack failed",
            extra={
                "owner": owner,
                "repo": repo_name,
                "return_code": return_code,
                "stderr": stderr_data.decode("utf-8", errors="replace")[:500],
            },
        )

    # Parse the CGI response: split headers from body at the blank line
    if b"\r\n\r\n" in stdout_data:
        header_part, _, body_part = stdout_data.partition(b"\r\n\r\n")
    elif b"\n\n" in stdout_data:
        header_part, _, body_part = stdout_data.partition(b"\n\n")
    else:
        header_part, body_part = b"", stdout_data

    response_headers: dict[str, str] = {"Content-Type": _CT_RECEIVE_PACK_RES}
    for line in header_part.decode("utf-8", errors="replace").splitlines():
        if ":" in line and not line.lower().startswith("status:"):
            key, _, val = line.partition(":")
            response_headers[key.strip()] = val.strip()

    # Fire the post-receive hook asynchronously (don't block the git client)
    if return_code == 0:
        _fire_post_receive_hook(
            repo_id=str(repo.id),
            disk_path=repo.disk_path,
            pusher_username=user.username,
            stderr_output=stderr_data.decode("utf-8", errors="replace"),
        )

    logger.info(
        "git push completed",
        extra={
            "owner": owner,
            "repo": repo_name,
            "pusher": user.username,
            "return_code": return_code,
        },
    )

    return Response(
        content=body_part,
        status_code=200 if return_code == 0 else 500,
        headers=response_headers,
        media_type=_CT_RECEIVE_PACK_RES,
    )


def _fire_post_receive_hook(
    repo_id: str,
    disk_path: str,
    pusher_username: str,
    stderr_output: str,
) -> None:
    """
    Enqueue the post-receive Celery task.

    Called synchronously from the receive-pack handler after the subprocess
    completes.  The task itself runs asynchronously in the worker process.
    """
    try:
        from app.worker.tasks.git_tasks import post_receive_hook
        post_receive_hook.delay(
            repo_id=repo_id,
            disk_path=disk_path,
            pusher_username=pusher_username,
            receive_pack_output=stderr_output,
        )
    except Exception as exc:
        # Non-fatal: the push already succeeded; the hook failing means
        # the Branch cache will be stale until the next push.
        logger.error(
            "Failed to enqueue post-receive hook",
            extra={"repo_id": repo_id, "error": str(exc)},
        )
