import os
import json
from dotenv import load_dotenv

load_dotenv()

# Ensure local services (Milvus gRPC) bypass proxy
_no_proxy = os.environ.get("no_proxy", "")
if "localhost" not in _no_proxy:
    os.environ["no_proxy"] = f"{_no_proxy},localhost,127.0.0.1" if _no_proxy else "localhost,127.0.0.1"
    os.environ["NO_PROXY"] = os.environ["no_proxy"]

# --- settings.json 路径 ---
_SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "settings.json")


def _load_settings() -> dict:
    """从 settings.json 读取配置"""
    if os.path.exists(_SETTINGS_FILE):
        with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


_settings = _load_settings()

# --- Model Provider ---
# "openai" or "bailian"
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "openai")

# --- OpenAI ---
# settings.json 优先，环境变量兜底
OPENAI_API_KEY = _settings.get("openai_api_key") or os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = _settings.get("openai_base_url") or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_CHAT_MODEL = "gpt-4o"

# --- 百炼 (DashScope Compatible Mode) ---
BAILIAN_API_KEY = _settings.get("bailian_api_key") or os.getenv("BAILIAN_API_KEY", "")
BAILIAN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
BAILIAN_EMBEDDING_MODEL = "text-embedding-v1"
BAILIAN_CHAT_MODEL = "qwen-plus"


def reload_from_settings():
    """热更新：重新从 settings.json 加载 API key 配置"""
    global OPENAI_API_KEY, OPENAI_BASE_URL, BAILIAN_API_KEY, _settings
    _settings = _load_settings()
    OPENAI_API_KEY = _settings.get("openai_api_key") or os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL = _settings.get("openai_base_url") or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    BAILIAN_API_KEY = _settings.get("bailian_api_key") or os.getenv("BAILIAN_API_KEY", "")

# --- Milvus ---
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = int(os.getenv("MILVUS_PORT", "19530"))
MILVUS_COLLECTION = os.getenv("MILVUS_COLLECTION", "rag_documents")

# --- Embedding dimensions ---
EMBEDDING_DIM = {
    "openai": 1536,
    "bailian": 768,
}

# --- Milvus Index ---
HNSW_M = 16
HNSW_EF_CONSTRUCTION = 200
HNSW_EF = 64
SEARCH_TOP_K = 5

# --- Chunk ---
DEFAULT_CHUNK_SIZE = 500
DEFAULT_OVERLAP = 100

# --- Upload ---
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
