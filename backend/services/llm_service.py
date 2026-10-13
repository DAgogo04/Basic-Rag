import os
import httpx
from collections.abc import AsyncGenerator
from openai import AsyncOpenAI
import config


def _make_http_client() -> httpx.AsyncClient | None:
    proxy = os.environ.get("http_proxy") or os.environ.get("https_proxy")
    if proxy:
        return httpx.AsyncClient(proxy=proxy)
    return None


def _get_chat_client(model_provider: str) -> tuple[AsyncOpenAI, str]:
    http_client = _make_http_client()
    if model_provider == "bailian":
        client = AsyncOpenAI(
            api_key=config.BAILIAN_API_KEY,
            base_url=config.BAILIAN_BASE_URL,
            **({"http_client": http_client} if http_client else {}),
        )
        model = config.BAILIAN_CHAT_MODEL
    else:
        client = AsyncOpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_BASE_URL,
            **({"http_client": http_client} if http_client else {}),
        )
        model = config.OPENAI_CHAT_MODEL
    return client, model


async def call_llm(
    messages: list[dict],
    model_provider: str = "openai",
    temperature: float = 0.7,
) -> str:
    client, model = _get_chat_client(model_provider)
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content


async def generate_answer(question: str, contexts: list[str], model_provider: str = "openai") -> tuple[str, str]:
    context_text = "\n".join([f"{i+1}. {ctx}" for i, ctx in enumerate(contexts)])

    system_content = (
        "你是一个知识库问答助手。请根据提供的参考资料回答用户问题。"
        "如果参考资料中没有相关信息，请如实告知。不要编造信息。"
    )
    user_content = f"参考资料：\n{context_text}\n\n问题：\n{question}"

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]

    full_prompt = f"[System]\n{system_content}\n\n[User]\n{user_content}"
    answer = await call_llm(messages, model_provider=model_provider)
    return answer, full_prompt


async def stream_answer(
    question: str, contexts: list[str], model_provider: str = "openai"
) -> tuple[AsyncGenerator[str, None], str]:
    context_text = "\n".join([f"{i+1}. {ctx}" for i, ctx in enumerate(contexts)])

    system_content = (
        "你是一个知识库问答助手。请根据提供的参考资料回答用户问题。"
        "如果参考资料中没有相关信息，请如实告知。不要编造信息。"
    )
    user_content = f"参考资料：\n{context_text}\n\n问题：\n{question}"

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]

    full_prompt = f"[System]\n{system_content}\n\n[User]\n{user_content}"

    client, model = _get_chat_client(model_provider)

    async def _generate() -> AsyncGenerator[str, None]:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    return _generate(), full_prompt
