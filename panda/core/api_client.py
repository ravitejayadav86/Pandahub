"""
panda.core.api_client — Thin HTTP client for the PandaHub REST API.

Handles attaching the bearer token to requests and transparently retrying
once on a 401 by refreshing the access token via /auth/refresh — mirrors
what a browser session would do with the frontend's token pair.
"""
from __future__ import annotations

from typing import Any, Optional

import requests

from panda.core import config


class ApiError(Exception):
    """Raised when the API returns a non-2xx response."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"API error {status_code}: {detail}")


def _extract_detail(response: requests.Response) -> str:
    try:
        body = response.json()
        if isinstance(body, dict):
            return str(body.get("detail") or body.get("message") or body)
        return str(body)
    except ValueError:
        return response.text or f"HTTP {response.status_code}"


def _refresh_access_token() -> bool:
    refresh_token = config.get_refresh_token()
    username = config.get_username()
    if not refresh_token:
        return False

    base_url = config.get_api_base_url()
    try:
        resp = requests.post(
            f"{base_url}/auth/refresh",
            json={"refresh_token": refresh_token},
            timeout=15,
        )
    except requests.RequestException:
        return False

    if resp.status_code != 200:
        return False

    data = resp.json()
    config.save_tokens(data["access_token"], data["refresh_token"], username or "")
    return True


def request(
    method: str,
    path: str,
    json_body: Optional[dict[str, Any]] = None,
    params: Optional[dict[str, Any]] = None,
    auth_required: bool = True,
    _retried: bool = False,
) -> Any:
    base_url = config.get_api_base_url()
    url = f"{base_url}{path}"
    headers = {}

    if auth_required:
        token = config.get_access_token()
        if not token:
            raise ApiError(401, "Not logged in. Run `panda login` first.")
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.request(
            method, url, json=json_body, params=params, headers=headers, timeout=30
        )
    except requests.RequestException as exc:
        raise ApiError(0, f"Network error: {exc}") from exc

    if resp.status_code == 401 and auth_required and not _retried:
        if _refresh_access_token():
            return request(
                method, path, json_body, params, auth_required, _retried=True
            )
        raise ApiError(401, "Session expired. Run `panda login` again.")

    if not resp.ok:
        raise ApiError(resp.status_code, _extract_detail(resp))

    if resp.status_code == 204 or not resp.content:
        return None

    return resp.json()
