# RAG 知识库系统教学文档

> 本文档以本项目为例，从零讲解如何使用向量数据库构建一个 **检索增强生成 (RAG)** 知识库系统。

---

## 目录

1. [什么是 RAG？](#1-什么是-rag)
2. [系统架构总览](#2-系统架构总览)
3. [环境准备与安装](#3-环境准备与安装)
4. [核心概念讲解](#4-核心概念讲解)
5. [用户旅程：从上传到问答的完整链路](#5-用户旅程从上传到问答的完整链路)
6. [关键代码解读](#6-关键代码解读)
7. [API 接口一览](#7-api-接口一览)

---

## 1. 什么是 RAG？

**RAG (Retrieval-Augmented Generation)** 是一种让大语言模型「先查资料，再回答」的技术范式。

传统直接调用 LLM 的问题：
- LLM 只知道训练数据中的知识，无法回答你私有文档里的内容
- 直接把所有文档塞进 prompt，会超过上下文窗口限制

RAG 的解决思路：

```
用户提问 → 从知识库中检索相关段落 → 将段落作为参考资料拼入 prompt → LLM 基于资料生成回答
```

本系统的完整 RAG 流程：

```
┌──────────────────────────────── 离线阶段：文档入库 ──────────────────────────────────┐
│                                                                                    │
│   上传文档 → 文本抽取 → 文本清洗 → 文本分块 → Embedding 向量化 → 写入向量数据库     │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────── 在线阶段：检索问答 ────────────────────────────────┐
│                                                                                    │
│   用户提问 → 问题 Embedding → 向量相似度检索 → (可选)Rerank → 拼装 Prompt → LLM    │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 系统架构总览

```
knowledgebase/
├── backend/                     # Python FastAPI 后端
│   ├── main.py                  # 应用入口
│   ├── config.py                # 全局配置（API Key、Milvus 连接、模型参数）
│   ├── settings.json            # 持久化 API Key 配置（运行时生成）
│   ├── api/
│   │   ├── document.py          # 文档上传/删除/查看接口
│   │   ├── query.py             # 知识问答接口（含流式）
│   │   └── settings.py          # API Key 配置接口
│   ├── services/
│   │   ├── extract_service.py   # 文本抽取（PDF/DOCX/TXT/MD）
│   │   ├── clean_service.py     # 文本清洗
│   │   ├── chunk_service.py     # 文本分块（滑动窗口/语义/混合）
│   │   ├── embedding_service.py # Embedding 向量生成
│   │   ├── llm_service.py       # LLM 对话 & 流式回答
│   │   └── milvus_service.py    # Milvus 向量数据库操作
│   └── models/
│       └── schema.py            # Pydantic 数据模型
│
└── frontend/                    # React + TypeScript 前端
    └── src/
        ├── api/ragApi.ts        # 后端 API 调用封装
        ├── store/appStore.ts    # Zustand 全局状态
        ├── pages/               # 页面组件
        └── components/          # UI 组件
```

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 向量数据库 | **Milvus** | 存储文档 Embedding、执行 ANN 近似最近邻检索 |
| Embedding | OpenAI `text-embedding-3-small` / 通义 `text-embedding-v1` | 将文本转换为高维向量 |
| LLM | OpenAI `gpt-4o` / 通义 `qwen-plus` | 生成最终回答 |
| 后端框架 | FastAPI + Uvicorn | 异步 API 服务 |
| 前端框架 | React + TypeScript + Tailwind CSS | 用户界面 |
| 向量索引 | HNSW (Hierarchical Navigable Small World) | 高效近似最近邻搜索算法 |

---

## 3. 环境准备与安装

### 3.1 安装 Milvus 向量数据库

Milvus 是一款开源的高性能向量数据库，专为 Embedding 相似度搜索设计。

**方式一：Docker 安装（推荐）**

```bash
# 下载 docker-compose 配置
wget https://github.com/milvus-io/milvus/releases/download/v2.4.7/milvus-standalone-docker-compose.yml -O docker-compose.yml

# 启动 Milvus
docker compose up -d
```

启动后，Milvus 在以下端口提供服务：
- **19530** — gRPC 端口（pymilvus 连接用）
- **9091** — HTTP 健康检查端口

验证是否启动成功：

```bash
docker compose ps
# 应看到 milvus-standalone 状态为 running
```

**方式二：Milvus Lite（纯 Python，适合开发测试）**

```bash
pip install milvus-lite
```

此模式无需 Docker，直接在 Python 进程内运行，适合快速体验。

### 3.2 安装后端依赖

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` 核心依赖：

```
fastapi==0.115.0      # Web 框架
uvicorn==0.30.6       # ASGI 服务器
pymilvus==2.4.7       # Milvus Python SDK
openai==1.51.0        # OpenAI SDK（同时兼容通义千问）
pdfplumber==0.11.4    # PDF 文本抽取
python-docx==1.1.2    # DOCX 文本抽取
tiktoken==0.8.0       # Token 计数（用于分块）
pydantic==2.9.2       # 数据校验
```

### 3.3 配置 API Key

有两种方式配置：

**方式一：通过前端页面（推荐）**

启动服务后，访问侧边栏「API 配置」页面，填入 Key 即可。配置保存在 `backend/settings.json`。

**方式二：通过环境变量**

```bash
# .env 文件
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1    # 可选，默认官方地址

BAILIAN_API_KEY=sk-xxxxxxxx                   # 通义千问（百炼平台）
```

> 优先级：`settings.json` > 环境变量

### 3.4 启动服务

```bash
# 后端
cd backend && source venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

---

## 4. 核心概念讲解

### 4.1 Embedding（向量化）

Embedding 是将文本映射为一个固定维度的浮点数向量。语义相似的文本，其向量在空间中距离更近。

```
"今天天气真好" → [0.023, -0.156, 0.892, ..., 0.034]  (1536 维)
"今日阳光明媚" → [0.021, -0.148, 0.887, ..., 0.031]  (1536 维)  ← 向量很接近
"数据库索引"   → [0.567, 0.234, -0.123, ..., 0.789]  (1536 维)  ← 向量差别大
```

本项目使用的 Embedding 模型：

| Provider | 模型 | 向量维度 |
|----------|------|----------|
| OpenAI | `text-embedding-3-small` | 1536 |
| 通义千问 | `text-embedding-v1` | 768 |

调用方式（`embedding_service.py`）：

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key="sk-xxx", base_url="https://api.openai.com/v1")

# 单条文本向量化
response = await client.embeddings.create(
    input="今天天气真好",
    model="text-embedding-3-small",
)
vector = response.data[0].embedding   # list[float]，长度 1536

# 批量向量化（一次请求多条）
response = await client.embeddings.create(
    input=["文本1", "文本2", "文本3"],
    model="text-embedding-3-small",
)
vectors = [item.embedding for item in response.data]
```

> 通义千问百炼平台也兼容 OpenAI SDK 的接口格式，只需替换 `base_url` 和 `api_key` 即可。

### 4.2 向量数据库 Milvus

#### 为什么需要向量数据库？

传统数据库（MySQL、PostgreSQL）做的是精确匹配：`WHERE name = 'xxx'`。

向量数据库做的是**近似最近邻搜索 (ANN)**：给定一个查询向量，快速找出数据库中与它最相似的 Top K 个向量。

对比：

| | 传统数据库 | 向量数据库 |
|---|---|---|
| 查询方式 | `WHERE column = value` | 余弦相似度 / 欧氏距离 |
| 数据类型 | 字符串、数字、日期 | 高维浮点向量 |
| 索引类型 | B-Tree、Hash | HNSW、IVF_FLAT |
| 典型场景 | 业务数据 CRUD | 语义搜索、推荐、RAG |

#### Collection（集合）

Milvus 中的 Collection 类似关系数据库中的 Table。本项目的 Schema：

```python
fields = [
    FieldSchema(name="id",      dtype=DataType.INT64,        is_primary=True, auto_id=True),
    FieldSchema(name="doc_id",  dtype=DataType.VARCHAR,      max_length=256),
    FieldSchema(name="content", dtype=DataType.VARCHAR,      max_length=65535),
    FieldSchema(name="vector",  dtype=DataType.FLOAT_VECTOR, dim=1536),
]
```

| 字段 | 含义 |
|------|------|
| `id` | 自增主键 |
| `doc_id` | 文档 ID（UUID），用于按文档维度管理 |
| `content` | 文本块原文 |
| `vector` | 文本块的 Embedding 向量 |

集合名按 `rag_documents_{provider}` 区分（因为不同模型的向量维度不同）。

#### HNSW 索引

本项目使用 HNSW 索引，它的核心思想是构建一个多层的跳表图结构：

```python
index_params = {
    "index_type": "HNSW",
    "metric_type": "COSINE",        # 使用余弦相似度
    "params": {
        "M": 16,                    # 每个节点的最大连接数
        "efConstruction": 200,      # 建图时的搜索范围（越大索引质量越高）
    },
}
collection.create_index(field_name="vector", index_params=index_params)
```

搜索时的参数：

```python
search_params = {
    "metric_type": "COSINE",
    "params": {"ef": 64},            # 搜索时的候选集大小（越大精度越高、速度越慢）
}
```

> **COSINE 相似度**：值域 [0, 1]，越接近 1 表示越相似。本项目在前端展示为百分比。

#### 基本操作

```python
from pymilvus import connections, Collection, utility

# 1. 连接
connections.connect(host="localhost", port=19530)

# 2. 创建集合（见上方 Schema）
collection = Collection(name="rag_documents_openai", schema=schema)
collection.create_index(field_name="vector", index_params=index_params)
collection.load()  # 加载到内存，才能搜索

# 3. 写入数据
collection.insert([
    ["doc-uuid-1"] * 3,                          # doc_id 列
    ["文本块1", "文本块2", "文本块3"],              # content 列
    [[0.1, 0.2, ...], [0.3, 0.4, ...], [...]],   # vector 列
])
collection.flush()  # 持久化

# 4. 向量搜索
results = collection.search(
    data=[query_vector],          # 查询向量
    anns_field="vector",          # 在哪个字段上搜索
    param=search_params,
    limit=5,                      # 返回 Top 5
    output_fields=["doc_id", "content"],  # 同时返回这些字段
)

for hit in results[0]:
    print(f"相似度: {hit.score:.4f}, 内容: {hit.entity.get('content')}")

# 5. 按条件删除
collection.delete(expr='doc_id == "doc-uuid-1"')

# 6. 删除整个集合
utility.drop_collection("rag_documents_openai")
```

### 4.3 文本分块 (Chunking)

长文档不能整篇存为一条向量——那样检索精度差、超出 Embedding 模型输入限制。需要先拆成小块。

本项目提供三种分块策略：

#### 策略一：滑动窗口分块 (`sliding`)

```
原文 tokens: [t0, t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11]
chunk_size=5, overlap=2

chunk 0: [t0,  t1,  t2,  t3,  t4]
chunk 1:           [t3,  t4,  t5,  t6,  t7]     ← overlap 2 个 token
chunk 2:                      [t6,  t7,  t8,  t9,  t10]
chunk 3:                                 [t9,  t10, t11]
```

代码实现（`chunk_service.py`）：

```python
def sliding_window_chunk(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = start + chunk_size
        chunk_tokens = tokens[start:end]
        chunk_text = enc.decode(chunk_tokens)
        if chunk_text.strip():
            chunks.append(chunk_text.strip())
        if end >= len(tokens):
            break
        start += chunk_size - overlap
    return chunks
```

> 使用 `tiktoken` 按 **token** 而非字符来计算长度，与 LLM 的计费方式一致。

#### 策略二：语义分块 (`semantic`)

让 LLM 按语义自动划分，不需要指定固定长度：

```python
prompt = "请将以下文本按语义段落进行分块...返回 JSON 格式: {\"chunks\": [...]}"
response = await call_llm(messages=[{"role": "user", "content": prompt}])
chunks = json.loads(response)["chunks"]
```

#### 策略三：混合模式 (`hybrid`)

先用 LLM 做语义分块，再对超长的块用滑动窗口裁剪，兼顾语义完整性和长度控制。

### 4.4 Rerank（重排序）

向量检索基于余弦相似度，但 Embedding 模型对某些细微语义差异可能判断不准。Rerank 是在初次检索结果上做二次排序。

本项目使用 LLM 做 Rerank——让模型对每条结果和问题的相关性打分（0-10 分）：

```python
prompt = (
    "请对以下文本段落与问题的相关性进行打分（0-10分），返回 JSON 格式。\n"
    "格式: {\"scores\": [分数1, 分数2, ...]}\n"
    f"问题：{question}\n"
    f"段落：\n[0] 第一段内容...\n[1] 第二段内容..."
)
# LLM 返回: {"scores": [8, 3, 9, 5, 7]}
# 按分数重排，最相关的排最前
```

Rerank 后的效果：

```
检索结果（rerank 前）:        检索结果（rerank 后）:
#1 相似度 85.2%  → rerank 6分   #1 相似度 78.1%  → rerank 9分 ✓
#2 相似度 82.0%  → rerank 3分   #2 相似度 85.2%  → rerank 6分
#3 相似度 78.1%  → rerank 9分   #3 相似度 76.5%  → rerank 5分
```

---

## 5. 用户旅程：从上传到问答的完整链路

### 旅程一：上传文档入库

```
用户上传 report.docx
        │
        ▼
┌─ Step 1: 文本抽取 ─────────────────────────────────────────────────┐
│  extract_service.py                                                 │
│  使用 python-docx 逐段提取文本                                       │
│  doc = Document("report.docx")                                      │
│  texts = [para.text for para in doc.paragraphs]                     │
│  输出: "本公司2024年营收达到50亿元...产品线包括..."                     │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 2: 文本清洗 ─────────────────────────────────────────────────┐
│  clean_service.py                                                   │
│  - 删除页码（"第1页"、"Page 1"、"- 1 -"）                            │
│  - 删除不可见控制字符                                                 │
│  - 合并多余换行和空格                                                 │
│  - 去除每行首尾空格                                                   │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 3: 文本分块 ─────────────────────────────────────────────────┐
│  chunk_service.py                                                   │
│  以"滑动窗口"为例（chunk_size=500 tokens, overlap=100 tokens）：      │
│                                                                     │
│  输入: 一篇 2000 token 的文档                                        │
│  输出: 5 个文本块                                                    │
│    chunk[0]: token 0-499    "本公司2024年营收达到50亿元..."            │
│    chunk[1]: token 400-899  "...达到50亿元。其中消费电子业务..."        │
│    chunk[2]: token 800-1299 "...消费电子业务同比增长20%..."             │
│    chunk[3]: token 1200-1699                                        │
│    chunk[4]: token 1600-1999                                        │
│                                                                     │
│  每相邻两块有 100 token 重叠，保证上下文不被截断丢失。                   │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 4: Embedding 向量化 ─────────────────────────────────────────┐
│  embedding_service.py                                               │
│                                                                     │
│  将 5 个文本块一次性发给 OpenAI Embedding API：                       │
│  response = await client.embeddings.create(                         │
│      input=["chunk0 文本", "chunk1 文本", ...],                      │
│      model="text-embedding-3-small"                                 │
│  )                                                                  │
│                                                                     │
│  输出: 5 个 1536 维向量                                              │
│    chunk[0] → [0.023, -0.156, 0.892, ..., 0.034]                   │
│    chunk[1] → [0.019, -0.141, 0.878, ..., 0.029]                   │
│    ...                                                              │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 5: 写入 Milvus ─────────────────────────────────────────────┐
│  milvus_service.py                                                  │
│                                                                     │
│  collection.insert([                                                │
│      ["doc-uuid"] * 5,       # doc_id                               │
│      [chunk0, chunk1, ...],  # content                              │
│      [vec0, vec1, ...],      # vector                               │
│  ])                                                                 │
│  collection.flush()          # 持久化到磁盘                          │
│                                                                     │
│  入库完成！5 条记录写入 rag_documents_openai 集合。                   │
└─────────────────────────────────────────────────────────────────────┘
```

**对应代码入口**：`api/document.py` → `upload_document()` 函数，完整串联了以上 5 步。

---

### 旅程二：用户提问 → 检索 → 回答

```
用户提问: "公司2024年营收是多少？"
        │
        ▼
┌─ Step 1: 问题 Embedding ──────────────────────────────────────────┐
│  embedding_service.py                                               │
│                                                                     │
│  query_vector = await generate_embedding(                           │
│      "公司2024年营收是多少？",                                        │
│      model_provider="openai"                                        │
│  )                                                                  │
│  → [0.045, -0.132, 0.756, ..., 0.088]  (1536维)                    │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 2: Milvus 向量检索 ─────────────────────────────────────────┐
│  milvus_service.py → search_chunks()                                │
│                                                                     │
│  collection.search(                                                 │
│      data=[query_vector],                                           │
│      anns_field="vector",      # 在 vector 字段上搜索                │
│      param={                                                        │
│          "metric_type": "COSINE",                                   │
│          "params": {"ef": 64}  # HNSW 搜索参数                      │
│      },                                                             │
│      limit=5,                  # 返回 Top 5                         │
│      output_fields=["doc_id", "content"],                           │
│  )                                                                  │
│                                                                     │
│  返回结果（按余弦相似度排序）：                                        │
│    #1  score=0.912  "本公司2024年营收达到50亿元，同比增长15%..."       │
│    #2  score=0.856  "...2024财年利润率达到12.3%..."                   │
│    #3  score=0.831  "...消费电子业务同比增长20%..."                    │
│    #4  score=0.798  "...2023年营收为43.5亿元..."                      │
│    #5  score=0.745  "...未来三年战略规划..."                           │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 3: Rerank 重排序（可选）────────────────────────────────────┐
│  query.py → rerank_chunks()                                         │
│                                                                     │
│  将 5 条结果和原始问题一起发给 LLM：                                  │
│  "请对以下文本段落与问题的相关性进行打分（0-10分）"                     │
│                                                                     │
│  LLM 返回: {"scores": [9, 5, 4, 7, 2]}                             │
│                                                                     │
│  重排后：                                                            │
│    #1  rerank=9  "本公司2024年营收达到50亿元..."    （原 #1）         │
│    #2  rerank=7  "...2023年营收为43.5亿元..."       （原 #4 ↑）       │
│    #3  rerank=5  "...2024财年利润率达到12.3%..."    （原 #2 ↓）       │
│    #4  rerank=4  "...消费电子业务同比增长20%..."    （原 #3 ↓）       │
│    #5  rerank=2  "...未来三年战略规划..."           （原 #5）         │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 4: 拼装 Prompt ─────────────────────────────────────────────┐
│  llm_service.py → generate_answer() / stream_answer()               │
│                                                                     │
│  messages = [                                                       │
│    {                                                                │
│      "role": "system",                                              │
│      "content": "你是一个知识库问答助手。请根据提供的参考资料回答      │
│                  用户问题。如果参考资料中没有相关信息，请如实告知。     │
│                  不要编造信息。"                                      │
│    },                                                               │
│    {                                                                │
│      "role": "user",                                                │
│      "content": "参考资料：                                          │
│        1. 本公司2024年营收达到50亿元，同比增长15%...                   │
│        2. ...2023年营收为43.5亿元...                                  │
│        3. ...2024财年利润率达到12.3%...                               │
│        4. ...消费电子业务同比增长20%...                                │
│        5. ...未来三年战略规划...                                      │
│                                                                     │
│        问题：                                                        │
│        公司2024年营收是多少？"                                        │
│    }                                                                │
│  ]                                                                  │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 5: LLM 生成回答 ────────────────────────────────────────────┐
│  llm_service.py                                                     │
│                                                                     │
│  调用 OpenAI Chat API（支持流式输出）：                               │
│  response = await client.chat.completions.create(                   │
│      model="gpt-4o",                                                │
│      messages=messages,                                             │
│      stream=True,              # 流式输出，逐字返回                   │
│  )                                                                  │
│                                                                     │
│  LLM 回答:                                                          │
│  "根据参考资料，公司2024年营收达到50亿元，同比增长15%。"               │
│                                                                     │
│  通过 SSE (Server-Sent Events) 逐字推送给前端，实现打字机效果。       │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
  前端展示回答 + 检索过程面板（可展开查看每条检索结果的相似度和 Rerank 分数）
```

**对应代码入口**：`api/query.py` → `query_stream()` 函数。

---

## 6. 关键代码解读

### 6.1 Milvus 连接与集合管理

```python
# milvus_service.py

def connect_milvus():
    """单例连接，避免重复创建"""
    global _connected
    if _connected:
        return
    connections.connect(host=config.MILVUS_HOST, port=config.MILVUS_PORT)
    _connected = True

def get_or_create_collection(model_provider: str = "openai") -> Collection:
    """如果集合已存在则直接返回，否则创建新集合并建索引"""
    connect_milvus()
    dim = config.EMBEDDING_DIM.get(model_provider, 1536)
    collection_name = f"{config.MILVUS_COLLECTION}_{model_provider}"

    if utility.has_collection(collection_name):
        collection = Collection(collection_name)
        collection.load()       # 加载到内存才能搜索
        return collection

    # 创建 Schema → 建集合 → 建 HNSW 索引 → 加载
    fields = [
        FieldSchema(name="id",      dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(name="doc_id",  dtype=DataType.VARCHAR, max_length=256),
        FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
        FieldSchema(name="vector",  dtype=DataType.FLOAT_VECTOR, dim=dim),
    ]
    schema = CollectionSchema(fields=fields)
    collection = Collection(name=collection_name, schema=schema)
    collection.create_index(field_name="vector", index_params={...})
    collection.load()
    return collection
```

### 6.2 向量检索

```python
# milvus_service.py

def search_chunks(query_vector, model_provider="openai", top_k=5):
    collection = get_or_create_collection(model_provider)
    results = collection.search(
        data=[query_vector],                  # 查询向量（二维数组，支持批量）
        anns_field="vector",                  # 搜索哪个向量字段
        param={"metric_type": "COSINE", "params": {"ef": 64}},
        limit=top_k,
        output_fields=["doc_id", "content"],  # 搜索同时取回这些标量字段
    )
    # results[0] 对应第一条查询的结果列表
    hits = []
    for result in results[0]:
        hits.append({
            "doc_id":  result.entity.get("doc_id"),
            "content": result.entity.get("content"),
            "score":   result.score,          # 余弦相似度 0~1
        })
    return hits
```

### 6.3 流式问答 (SSE)

后端使用 FastAPI 的 `StreamingResponse` + async generator 实现 SSE：

```python
# query.py

@router.post("/query/stream")
async def query_stream(req: QueryRequest):
    async def event_generator():
        # ... 检索、rerank 逻辑 ...

        # 1. 先发送 metadata（检索结果、prompt 等）
        yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"

        # 2. 逐块发送 LLM 回答
        async for chunk_text in llm_generator:
            yield f"event: delta\ndata: {json.dumps({'content': chunk_text})}\n\n"

        # 3. 发送结束信号
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

前端使用原生 `fetch` + `ReadableStream` 消费 SSE：

```typescript
// ragApi.ts

const res = await fetch('/api/query/stream', { method: 'POST', body: ... })
const reader = res.body.getReader()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // 解析 "event: xxx\ndata: {...}\n\n" 格式
  // 根据 event 类型调用不同回调：onMetadata / onDelta / onDone
}
```

---

## 7. API 接口一览

### 文档管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/document/upload` | 上传文档（支持 PDF/DOCX/TXT/MD） |
| GET | `/api/document/list` | 获取文档列表 |
| GET | `/api/document/{doc_id}/chunks` | 查看文档分块详情 |
| GET | `/api/document/{doc_id}/milvus` | 查看文档在向量库中的存储数据 |
| DELETE | `/api/document/{doc_id}` | 删除文档及其向量数据 |

### 知识问答

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/query` | 一次性返回完整回答 |
| POST | `/api/query/stream` | SSE 流式返回回答（逐字输出） |

请求体格式：

```json
{
    "question": "公司2024年营收是多少？",
    "model_provider": "openai",
    "top_k": 5,
    "use_rerank": true
}
```

### 系统配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取当前配置（API Key 脱敏显示） |
| POST | `/api/settings` | 保存 API Key 配置 |
| GET | `/api/health` | 健康检查 |
