import pytest
from unittest.mock import patch, MagicMock
from app.services.ai_service import generate_code_review
import httpx

@pytest.mark.asyncio
async def test_generate_code_review_empty_diff():
    # If the diff is empty, it should return a hardcoded empty response.
    result = await generate_code_review("")
    assert "No code changes" in result["summary"]
    assert result["suggestions"] == []


@pytest.mark.asyncio
@patch("app.services.ai_service.get_settings")
async def test_generate_code_review_no_key(mock_get_settings):
    # Setup mock config without a real key
    mock_settings = MagicMock()
    mock_settings.ANTHROPIC_API_KEY = None
    mock_get_settings.return_value = mock_settings

    diff = "+++ b/src/main.py\n+print('hello')"
    result = await generate_code_review(diff)

    # Should use the mock fallback
    assert "Mock Review" in result["summary"]
    assert len(result["suggestions"]) == 1
    assert result["suggestions"][0]["file"] == "src/main.py"


@pytest.mark.asyncio
@patch("app.services.ai_service.httpx.AsyncClient.post")
@patch("app.services.ai_service.get_settings")
async def test_generate_code_review_with_key(mock_get_settings, mock_post):
    # Setup mock config with a real key
    mock_settings = MagicMock()
    mock_settings.ANTHROPIC_API_KEY = "sk-fake-key"
    mock_settings.AI_MODEL = "test-model"
    mock_get_settings.return_value = mock_settings

    # Mock the httpx response
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {
        "content": [
            {
                "text": '{"summary": "Test summary", "suggestions": [{"file": "main.py", "comment": "Good."}]}'
            }
        ]
    }
    mock_post.return_value = mock_response

    diff = "+++ b/main.py\n+def foo(): pass"
    result = await generate_code_review(diff)

    assert result["summary"] == "Test summary"
    assert len(result["suggestions"]) == 1
    
    # Check that httpx was called correctly
    mock_post.assert_called_once()
    call_args, call_kwargs = mock_post.call_args
    assert call_args[0] == "https://api.anthropic.com/v1/messages"
    assert call_kwargs["headers"]["x-api-key"] == "sk-fake-key"
    assert "def foo(): pass" in call_kwargs["json"]["messages"][0]["content"]
