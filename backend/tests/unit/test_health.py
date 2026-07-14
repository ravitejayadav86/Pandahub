import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import get_settings

settings = get_settings()

@pytest.mark.asyncio
async def test_health_check():
    "Test the health check endpoint returns 200 OK."
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(f"{settings.API_V1_PREFIX}/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": settings.PROJECT_NAME}

        response2 = await client.get("/health")
        assert response2.status_code == 200
        assert response2.json() == {"status": "ok", "service": settings.PROJECT_NAME}
