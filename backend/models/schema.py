from pydantic import BaseModel
from typing import Optional


class UploadRequest(BaseModel):
    chunk_mode: str = "sliding"  # "sliding" | "semantic" | "hybrid"
    chunk_size: int = 500
    overlap: int = 100
    model_provider: str = "openai"  # "openai" | "bailian"


class QueryRequest(BaseModel):
    question: str
    model_provider: str = "openai"
    top_k: int = 5
    use_rerank: bool = True


class RetrievalHit(BaseModel):
    content: str
    score: float
    rerank_score: Optional[float] = None


class QueryResponse(BaseModel):
    answer: str
    contexts: list[str]
    retrieval: Optional[list[RetrievalHit]] = None
    use_rerank: bool = False
    prompt: Optional[str] = None


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    chunk_count: int
    status: str
    model_provider: str = "openai"
    chunk_mode: str = "sliding"
    chunk_size: int = 500
    overlap: int = 100
