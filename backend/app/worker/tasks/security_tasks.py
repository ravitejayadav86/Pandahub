import asyncio
import uuid
import pygit2
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from app.core.config import get_settings
from app.core.logging import get_logger
from app.worker.celery_app import celery_app
from app.models.security_alert import SecurityAlert, AlertType, AlertSeverity
from app.services.secret_scanner import scan_diff
from app.services.dep_scanner import scan_dependencies
from app.services.code_scanner import scan_code

settings = get_settings()
logger = get_logger("app.worker.tasks.security_tasks")

_sync_engine = None
_sync_session_factory = None

def _get_sync_session():
    global _sync_engine, _sync_session_factory
    if _sync_engine is None:
        sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://").replace("postgresql://", "postgresql+psycopg://")
        _sync_engine = create_engine(sync_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
        _sync_session_factory = sessionmaker(bind=_sync_engine, expire_on_commit=False)
    return _sync_session_factory()

def _run_async(coro):
    """Run an async coroutine synchronously."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@celery_app.task(
    name="app.worker.tasks.scan_repository_security",
    queue="ai_ops",  # Use ai_ops or a new security_ops queue. ai_ops is fine for heavy tasks.
    max_retries=1,
)
def scan_repository_security(repo_id: str, old_sha: str = None, new_sha: str = None):
    """
    Runs the full security suite on a repository:
      1. Secret scanning (if old_sha and new_sha are provided, scans the diff)
      2. Dependency vulnerability scanning (OSV)
      3. Code scanning (Semgrep)
    """
    logger.info(f"Starting security scan for repo {repo_id}")
    
    repo_uuid = uuid.UUID(repo_id)
    session = _get_sync_session()
    
    try:
        from app.models.repo import Repository
        repo = session.query(Repository).filter(Repository.id == repo_uuid).first()
        if not repo:
            logger.error(f"Repository {repo_id} not found for security scan")
            return
            
        disk_path = repo.disk_path
        new_alerts = []

        # 1. Secret Scanning (Fast, Regex based on Diff)
        if old_sha and new_sha:
            try:
                git_repo = pygit2.Repository(disk_path)
                
                # Handle initial push where old_sha might be all zeros
                if old_sha == "0000000000000000000000000000000000000000":
                    commit = git_repo.revparse_single(new_sha)
                    diff = commit.tree.diff_to_tree()
                else:
                    old_commit = git_repo.revparse_single(old_sha)
                    new_commit = git_repo.revparse_single(new_sha)
                    diff = git_repo.diff(old_commit, new_commit)
                
                diff_text = diff.patch
                if diff_text:
                    secret_findings = scan_diff(diff_text)
                    for sf in secret_findings:
                        alert = SecurityAlert(
                            repo_id=repo_uuid,
                            commit_sha=new_sha,
                            file_path=sf.file_path,
                            line_number=sf.line_number,
                            alert_type=AlertType.SECRET,
                            severity=AlertSeverity(sf.severity),
                            rule_id=sf.rule_id,
                            title=sf.title,
                            raw_finding=sf.raw_finding
                        )
                        new_alerts.append(alert)
            except Exception as e:
                logger.error(f"Secret scanning failed: {e}")

        # 2. Dependency Vulnerability Scanning (OSV API)
        try:
            # Requires async execution
            dep_findings = _run_async(scan_dependencies(disk_path))
            for df in dep_findings:
                alert = SecurityAlert(
                    repo_id=repo_uuid,
                    commit_sha=new_sha,
                    file_path=df.file_path,
                    alert_type=AlertType.VULNERABILITY,
                    severity=AlertSeverity(df.severity),
                    rule_id=df.vuln_id,
                    title=df.title,
                    description=df.description
                )
                new_alerts.append(alert)
        except Exception as e:
            logger.error(f"Dependency scanning failed: {e}")

        # 3. Code Quality / Static Analysis (Semgrep)
        try:
            code_findings = scan_code(disk_path)
            for cf in code_findings:
                alert = SecurityAlert(
                    repo_id=repo_uuid,
                    commit_sha=new_sha,
                    file_path=cf.file_path,
                    line_number=cf.line_number,
                    alert_type=AlertType.CODE_QUALITY,
                    severity=AlertSeverity(cf.severity),
                    rule_id=cf.rule_id,
                    title=cf.title,
                    description=cf.description,
                    raw_finding=cf.raw_snippet
                )
                new_alerts.append(alert)
        except Exception as e:
            logger.error(f"Code scanning failed: {e}")

        # Save all new alerts to DB
        if new_alerts:
            session.add_all(new_alerts)
            session.commit()
            logger.info(f"Saved {len(new_alerts)} new security alerts for repo {repo_id}")

    except Exception as e:
        session.rollback()
        logger.error(f"Security scan failed for {repo_id}: {e}")
    finally:
        session.close()

