import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models.schema import QueryRequest, QueryResponse, RetrievalHit
from services.embedding_service import generate_embedding
from services.milvus_service import search_chunks
from services.llm_service import generate_answer, stream_answer

router = APIRouter(prefix="/api", tags=["query"])


async def rerank_chunks(question: str, chunks: list[dict], model_provider: str = "openai") -> list[dict]:
    from services.llm_service import call_llm
    import json

    contents = [c["content"] for c in chunks]
    numbered = "\n".join([f"[{i}] {c}" for i, c in enumerate(contents)])

    prompt = (
        "请对以下文本段落与问题的相关性进行打分（0-10分），返回 JSON 格式。\n"
        "格式: {\"scores\": [分数1, 分数2, ...]}\n"
        "只返回 JSON，不要其他内容。\n\n"
        f"问题：{question}\n\n"
        f"段落：\n{numbered}"
    )

    try:
        response = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            model_provider=model_provider,
            temperature=0,
        )
        data = json.loads(response)
        scores = data.get("scores", [])
        if len(scores) == len(chunks):
            for i, chunk in enumerate(chunks):
                chunk["rerank_score"] = scores[i]
            chunks.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
    except Exception:
        pass

    return chunks


@router.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    query_vector = await generate_embedding(req.question, model_provider=req.model_provider)
    hits = search_chunks(query_vector, model_provider=req.model_provider, top_k=req.top_k)

    if not hits:
        return QueryResponse(answer="未找到相关文档内容，请先上传文档。", contexts=[])

    if req.use_rerank:
        hits = await rerank_chunks(req.question, hits, model_provider=req.model_provider)

    retrieval = []
    for hit in hits:
        retrieval.append(RetrievalHit(
            content=hit["content"],
            score=float(hit.get("score", 0)),
            rerank_score=float(hit["rerank_score"]) if hit.get("rerank_score") is not None else None,
        ))

    contexts = [hit["content"] for hit in hits]
    answer, prompt = await generate_answer(req.question, contexts, model_provider=req.model_provider)

    return QueryResponse(
        answer=answer,
        contexts=contexts,
        retrieval=retrieval,
        use_rerank=req.use_rerank,
        prompt=prompt,
    )


@router.post("/query/stream")
async def query_stream(req: QueryRequest):
    async def event_generator():
        query_vector = await generate_embedding(req.question, model_provider=req.model_provider)
        hits = search_chunks(query_vector, model_provider=req.model_provider, top_k=req.top_k)

        if not hits:
            yield f"event: metadata\ndata: {json.dumps({'retrieval': [], 'contexts': [], 'use_rerank': False, 'prompt': ''})}\n\n"
            yield f"event: delta\ndata: {json.dumps({'content': '未找到相关文档内容，请先上传文档。'})}\n\n"
            yield "event: done\ndata: {}\n\n"
            return

        if req.use_rerank:
            hits = await rerank_chunks(req.question, hits, model_provider=req.model_provider)

        retrieval = []
        for hit in hits:
            retrieval.append({
                "content": hit["content"],
                "score": float(hit.get("score", 0)),
                "rerank_score": float(hit["rerank_score"]) if hit.get("rerank_score") is not None else None,
            })

        contexts = [hit["content"] for hit in hits]
        gen, prompt = await stream_answer(req.question, contexts, model_provider=req.model_provider)

        metadata = {
            "retrieval": retrieval,
            "contexts": contexts,
            "use_rerank": req.use_rerank,
            "prompt": prompt,
        }
        yield f"event: metadata\ndata: {json.dumps(metadata, ensure_ascii=False)}\n\n"

        async for chunk_text in gen:
            yield f"event: delta\ndata: {json.dumps({'content': chunk_text}, ensure_ascii=False)}\n\n"

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
