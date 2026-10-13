import os
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from models.schema import DocumentInfo
import config
from services.extract_service import extract_text
from services.clean_service import clean_text
from services.chunk_service import chunk_text, count_tokens
from services.embedding_service import generate_embeddings
from services.milvus_service import insert_chunks, delete_doc_chunks, get_doc_chunks

router = APIRouter(prefix="/api/document", tags=["document"])

CHUNK_RESULTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chunk_results")
os.makedirs(CHUNK_RESULTS_DIR, exist_ok=True)

_documents: dict[str, DocumentInfo] = {}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    chunk_mode: str = Form("sliding"),
    chunk_size: int = Form(500),
    overlap: int = Form(100),
    model_provider: str = Form("openai"),
):
    if chunk_size < 50 or chunk_size > 5000:
        raise HTTPException(status_code=400, detail="chunk_size 应在 50-5000 之间")
    if overlap < 0 or overlap >= chunk_size:
        raise HTTPException(status_code=400, detail="overlap 应大于等于 0 且小于 chunk_size")
    if model_provider not in ("openai", "bailian"):
        raise HTTPException(status_code=400, detail="model_provider 仅支持 openai 或 bailian")
    if chunk_mode not in ("sliding", "semantic", "hybrid"):
        raise HTTPException(status_code=400, detail="chunk_mode 仅支持 sliding/semantic/hybrid")

    filename = file.filename or "unknown"
    file_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    if file_ext not in ("pdf", "docx", "txt", "md"):
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_ext}，仅支持 pdf/docx/txt/md")

    doc_id = str(uuid.uuid4())
    save_path = os.path.join(config.UPLOAD_DIR, f"{doc_id}.{file_ext}")

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    raw_text = extract_text(save_path, file_ext)
    cleaned = clean_text(raw_text)

    if not cleaned.strip():
        raise HTTPException(status_code=400, detail="文档内容为空")

    chunks = await chunk_text(
        cleaned,
        mode=chunk_mode,
        chunk_size=chunk_size,
        overlap=overlap,
        model_provider=model_provider,
    )

    if not chunks:
        raise HTTPException(status_code=400, detail="文档内容为空，无法分块")

    vectors = await generate_embeddings(chunks, model_provider=model_provider)
    insert_chunks(doc_id, chunks, vectors, model_provider=model_provider)

    _save_chunk_results(
        doc_id=doc_id,
        filename=filename,
        chunks=chunks,
        vectors=vectors,
        chunk_mode=chunk_mode,
        chunk_size=chunk_size,
        overlap=overlap,
        model_provider=model_provider,
    )

    doc_info = DocumentInfo(
        doc_id=doc_id,
        filename=filename,
        chunk_count=len(chunks),
        status="completed",
        model_provider=model_provider,
        chunk_mode=chunk_mode,
        chunk_size=chunk_size,
        overlap=overlap,
    )
    _documents[doc_id] = doc_info

    return {
        "doc_id": doc_id,
        "filename": filename,
        "chunk_count": len(chunks),
        "status": "completed",
        "model_provider": model_provider,
    }


@router.get("/list")
async def list_documents():
    return list(_documents.values())


@router.get("/{doc_id}/chunks")
async def get_chunk_results(doc_id: str):
    json_path = os.path.join(CHUNK_RESULTS_DIR, f"{doc_id}.json")
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="分块结果不存在")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/{doc_id}/milvus")
async def get_milvus_data(doc_id: str):
    if doc_id not in _documents:
        raise HTTPException(status_code=404, detail="文档不存在")
    provider = _documents[doc_id].model_provider
    rows = get_doc_chunks(doc_id, model_provider=provider)
    collection_name = f"{config.MILVUS_COLLECTION}_{provider}"
    dim = config.EMBEDDING_DIM.get(provider, 1536)
    records = []
    for row in rows:
        vec = row.get("vector", [])
        vec_list = [float(v) for v in vec]
        records.append({
            "id": int(row.get("id", 0)),
            "doc_id": row.get("doc_id"),
            "content": row.get("content"),
            "vector": {
                "dim": len(vec_list),
                "values_preview": [round(v, 6) for v in vec_list[:16]],
                "values_tail": [round(v, 6) for v in vec_list[-4:]],
            },
        })
    return {
        "collection": collection_name,
        "schema": {
            "fields": [
                {"name": "id", "type": "INT64", "primary_key": True, "auto_id": True},
                {"name": "doc_id", "type": "VARCHAR", "max_length": 256},
                {"name": "content", "type": "VARCHAR", "max_length": 65535},
                {"name": "vector", "type": "FLOAT_VECTOR", "dim": dim},
            ],
            "index": {
                "field": "vector",
                "type": "HNSW",
                "metric": "COSINE",
                "params": {"M": config.HNSW_M, "efConstruction": config.HNSW_EF_CONSTRUCTION},
            },
        },
        "total_records": len(records),
        "records": records,
    }


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, model_provider: str = "openai"):
    if doc_id in _documents:
        provider = _documents[doc_id].model_provider
        delete_doc_chunks(doc_id, model_provider=provider)
        for ext in ("json", "md"):
            path = os.path.join(CHUNK_RESULTS_DIR, f"{doc_id}.{ext}")
            if os.path.exists(path):
                os.remove(path)
        del _documents[doc_id]
        return {"message": "删除成功"}
    raise HTTPException(status_code=404, detail="文档不存在")


def _save_chunk_results(
    doc_id: str,
    filename: str,
    chunks: list[str],
    vectors: list[list[float]],
    chunk_mode: str,
    chunk_size: int,
    overlap: int,
    model_provider: str,
):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    json_data = {
        "doc_id": doc_id,
        "filename": filename,
        "created_at": now,
        "config": {
            "chunk_mode": chunk_mode,
            "chunk_size": chunk_size,
            "overlap": overlap,
            "model_provider": model_provider,
        },
        "total_chunks": len(chunks),
        "chunks": [],
    }
    for i, (text, vec) in enumerate(zip(chunks, vectors)):
        json_data["chunks"].append({
            "index": i,
            "token_count": count_tokens(text),
            "char_count": len(text),
            "content": text,
            "embedding_dim": len(vec),
            "embedding_preview": [round(v, 6) for v in vec[:8]],
        })

    json_path = os.path.join(CHUNK_RESULTS_DIR, f"{doc_id}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    lines = [
        f"# 分块结果：{filename}",
        "",
        f"- **文档 ID**: `{doc_id}`",
        f"- **处理时间**: {now}",
        f"- **分块模式**: {chunk_mode}",
        f"- **Chunk Size**: {chunk_size}",
        f"- **Overlap**: {overlap}",
        f"- **模型**: {model_provider}",
        f"- **总分块数**: {len(chunks)}",
        "",
        "---",
        "",
    ]
    for i, (text, vec) in enumerate(zip(chunks, vectors)):
        lines.append(f"## Chunk {i} ({count_tokens(text)} tokens, {len(text)} chars)")
        lines.append("")
        lines.append(f"**Embedding** ({len(vec)}d): `[{', '.join(f'{v:.4f}' for v in vec[:6])}  ...]`")
        lines.append("")
        lines.append("```")
        lines.append(text)
        lines.append("```")
        lines.append("")

    md_path = os.path.join(CHUNK_RESULTS_DIR, f"{doc_id}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
