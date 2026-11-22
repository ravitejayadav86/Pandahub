PandaHub AI Code Analysis - Integration Patch

What this patch adds:
- Authenticated POST /api/v1/code-analysis/analyze endpoint.
- Authenticated GET /api/v1/code-analysis/history endpoint.
- Authenticated GET /api/v1/code-analysis/{report_id} endpoint.
- Python AST checks (syntax errors, literal/assigned-zero division, eval/exec, bare except).
- Java lightweight checks plus javac compiler diagnostics when JDK is installed.
- User-scoped PostgreSQL report history.
- Next.js /code-analysis dashboard, linked from the existing dashboard navigation.
- JSON export and browser Print / Save PDF action.
- Optional AI explanation via the existing route_and_review() AI pipeline.

Important implementation limits:
- This is the first integration increment, not a complete replacement for Semgrep or a full Pylint/Bandit ruleset.
- Java compiler diagnostics require a JDK (javac) installed on the backend host/container.
- AI explanations require the existing configured AI provider; static analysis still completes if AI is unavailable.
- Quality score is a simple severity-weighted indicator, not a formal industry metric.
- The API currently analyzes pasted source text; repository-wide batch scanning and repo-linked reports are a follow-on increment.

Database:
- Adds Alembic revision 0004_code_analysis_history, descending from 0003_ai_routing_provenance.
- Uses the project's existing PostgreSQL database and authentication dependency.

Security:
- Rotate the Backblaze B2 application key that was embedded in the uploaded config.py.
- Keep all replacement credentials in deployment environment variables; never commit them.
- Do not upload .env files or secrets in future project archives.

Backblaze B2 credential handling:
- This patch removes the previously embedded B2 key defaults from backend/app/core/config.py.
- Before restarting/deploying, rotate the old application key in Backblaze and set B2_KEY_ID and B2_APPLICATION_KEY in the backend's environment settings.
- If either value is absent, B2 operations now fail with a clear configuration error rather than using a key committed in source.
