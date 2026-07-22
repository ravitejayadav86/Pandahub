"""
AI Service for Code Reviews (Module 11).

Provides a lightweight wrapper around Anthropic's Claude API via httpx,
falling back to a mocked response if ANTHROPIC_API_KEY is not configured
in the environment. This allows testing the UI and database flow locally
without incurring API costs.
"""
import json
import logging
from typing import Dict, Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppError

logger = logging.getLogger("app.services.ai_service")


SYSTEM_PROMPT = """You are an expert code reviewer.
Analyze the provided git diff and provide a code review.
Your response MUST be valid JSON with the following schema:
{
  "summary": "A high-level summary of the changes in Markdown format.",
  "suggestions": [
    {
      "file": "path/to/file",
      "comment": "Specific review feedback about a change in this file."
    }
  ]
}
Return ONLY the raw JSON object, without markdown code blocks, backticks, or any other text.
"""


def _generate_mock_review(diff_text: str) -> Dict[str, Any]:
    """Fallback review generator for when no API key is provided."""
    files_changed = []
    for line in diff_text.splitlines():
        if line.startswith("+++ b/"):
            files_changed.append(line[6:])
    
    suggestions = []
    for f in files_changed:
        suggestions.append({
            "file": f,
            "comment": f"Mock review: Consider checking for edge cases in `{f}`."
        })
        
    return {
        "summary": "### Mock Review\n\nNo API key was provided, so this is a simulated response. The PR modifies the following files:\n" + "\n".join(f"- `{f}`" for f in files_changed),
        "suggestions": suggestions,
    }


async def generate_code_review(diff_text: str) -> Dict[str, Any]:
    """
    Sends the diff to the configured LLM and returns the structured review.
    """
    settings = get_settings()
    
    if not diff_text.strip():
        return {
            "summary": "No code changes detected in this pull request.",
            "suggestions": []
        }

    # If no key is set, use the mock fallback
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "test-key":
        logger.info("No valid ANTHROPIC_API_KEY found, using mock AI review.")
        return _generate_mock_review(diff_text)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.AI_MODEL,
                    "max_tokens": 4096,
                    "system": SYSTEM_PROMPT,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Here is the git diff:\n\n{diff_text}"
                        }
                    ],
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Anthropic returns the text in content[0].text
            reply_text = data.get("content", [{}])[0].get("text", "{}").strip()
            
            # Strip markdown code blocks if the model ignored the system prompt
            if reply_text.startswith("```json"):
                reply_text = reply_text[7:]
            if reply_text.startswith("```"):
                reply_text = reply_text[3:]
            if reply_text.endswith("```"):
                reply_text = reply_text[:-3]
                
            return json.loads(reply_text.strip())
            
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during AI review generation: {e}")
        raise AppError("Failed to communicate with AI provider.")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI review JSON: {e}\nRaw output: {reply_text}")
        raise AppError("AI provider returned malformed JSON.")
    except Exception as e:
        logger.exception("Unexpected error during AI review generation")
        raise AppError("An unexpected error occurred during AI review generation.")
