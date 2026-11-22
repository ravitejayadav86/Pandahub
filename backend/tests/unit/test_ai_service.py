"""Tests for the real Anthropic-backed review service (no fake review fallback)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import AppError
from app.services.ai_service import generate_code_review


@pytest.mark.asyncio
async def test_generate_code_review_empty_diff():
    result = await generate_code_review("")
    assert "No code changes" in result["summary"]
    assert result["suggestions"] == []


@pytest.mark.asyncio
async def test_generate_code_review_no_key_is_explicit_failure():
    settings = MagicMock()
    settings.ANTHROPIC_API_KEY = None
    with patch("app.services.ai_service.get_settings", return_value=settings):
        with pytest.raises(AppError, match="not configured"):
            await generate_code_review("+++ b/src/main.py\n+print('hello')")


@pytest.mark.asyncio
async def test_generate_code_review_with_key_parses_provider_response():
    settings = MagicMock()
    settings.ANTHROPIC_API_KEY = "unit-test-anthropic-key"
    settings.AI_MODEL = "test-model"

    provider_response = MagicMock()
    provider_response.raise_for_status.return_value = None
    provider_response.json.return_value = {
        "content": [{
            "text": '{"summary": "Test summary", "suggestions": [{"file": "main.py", "comment": "Good."}]}'
        }]
    }

    client = MagicMock()
    client.post = AsyncMock(return_value=provider_response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("app.services.ai_service.get_settings", return_value=settings),
        patch("app.services.ai_service.httpx.AsyncClient", return_value=client),
    ):
        result = await generate_code_review("+++ b/main.py\n+def foo(): pass")

    assert result == {
        "summary": "Test summary",
        "suggestions": [{"file": "main.py", "comment": "Good."}],
    }
    client.post.assert_awaited_once()
    args, kwargs = client.post.call_args
    assert args[0] == "https://api.anthropic.com/v1/messages"
    assert kwargs["headers"]["x-api-key"] == "unit-test-anthropic-key"
    assert "def foo(): pass" in kwargs["json"]["messages"][0]["content"]
