import json
import os
from fastapi import APIRouter

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")

_ALLOWED_KEYS = {
    "openai_api_key",
    "openai_base_url",
    "bailian_api_key",
}


def _read_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _write_settings(data: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _mask(value: str) -> str:
    if not value or len(value) <= 8:
        return "*" * len(value) if value else ""
    return value[:4] + "*" * (len(value) - 8) + value[-4:]


@router.get("")
async def get_settings():
    settings = _read_settings()
    return {
        "openai_api_key": _mask(settings.get("openai_api_key", "")),
        "openai_base_url": settings.get("openai_base_url", ""),
        "bailian_api_key": _mask(settings.get("bailian_api_key", "")),
    }


@router.post("")
async def save_settings(body: dict):
    current = _read_settings()

    for key in _ALLOWED_KEYS:
        if key in body:
            value = body[key]
            if value and "*" not in value:
                current[key] = value

    _write_settings(current)

    import config
    config.reload_from_settings()

    return {"message": "配置已保存"}
