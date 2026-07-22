"""
Shared pytest configuration for the backend unit test suite.

Sets the minimum required environment variables before any app module is
imported, so ``get_settings()`` (called at module-level in security.py,
config.py, etc.) doesn't fail with ``ValidationError: Field required``.

These are TEST-ONLY dummy values — they are never used against a real
database or to sign tokens that leave the test process.
"""
import os

# Must be set BEFORE any app.* import so pydantic_settings picks them up
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/testdb")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-minimum-32-chars!!")
# Valid 32-byte Fernet key (url-safe base64, generated with Fernet.generate_key())
os.environ.setdefault("ENCRYPTION_KEY", "WrIdIZPBzWM9NuaaIfc-9IZSeN4MHZeSizsW22lQuX8=")
