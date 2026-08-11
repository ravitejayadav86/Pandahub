"""panda.core.config - Local CLI config storage."""
from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Any, Optional

CONFIG_DIR = Path.home() / ".pandahub"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_API_BASE_URL = "https://pandahub.onrender.com/api/v1"


def _ensure_config_dir() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(CONFIG_DIR, stat.S_IRWXU)
    except (OSError, NotImplementedError):
        pass


def load_config() -> dict[str, Any]:
    if not CONFIG_FILE.exists():
        return {"api_base_url": DEFAULT_API_BASE_URL}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("api_base_url", DEFAULT_API_BASE_URL)
        return data
    except (json.JSONDecodeError, OSError):
        return {"api_base_url": DEFAULT_API_BASE_URL}


def save_config(data: dict[str, Any]) -> None:
    _ensure_config_dir()
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    try:
        os.chmod(CONFIG_FILE, stat.S_IRUSR | stat.S_IWUSR)
    except (OSError, NotImplementedError):
        pass


def save_tokens(access_token: str, refresh_token: str, username: str) -> None:
    config = load_config()
    config["access_token"] = access_token
    config["refresh_token"] = refresh_token
    config["username"] = username
    save_config(config)


def get_access_token() -> Optional[str]:
    return load_config().get("access_token")


def get_refresh_token() -> Optional[str]:
    return load_config().get("refresh_token")


def get_username() -> Optional[str]:
    return load_config().get("username")


def get_api_base_url() -> str:
    return load_config().get("api_base_url", DEFAULT_API_BASE_URL)


def clear_tokens() -> None:
    config = load_config()
    config.pop("access_token", None)
    config.pop("refresh_token", None)
    config.pop("username", None)
    save_config(config)


def is_logged_in() -> bool:
    return get_access_token() is not None

def get_git_token() -> Optional[str]:
    return load_config().get("git_token")


def save_git_token(token: str) -> None:
    config = load_config()
    config["git_token"] = token
    save_config(config)
