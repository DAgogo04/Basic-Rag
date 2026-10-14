# RAG 知识库系统 — 开发提示词

> 将此提示词完整提供给 AI Agent（如 Claude Code、Cursor 等），即可从零开发出一个完整的 RAG 知识库问答系统。

---

## 项目概述

请帮我从零开发一个完整的 **RAG（Retrieval-Augmented Generation）知识库问答系统**，包含前端、后端、向量数据库和 Docker 一键部署。

系统核心功能：用户上传文档（PDF/DOCX/TXT/MD）→ 文本抽取 → 清洗 → 分块 → 生成 Embedding → 存入向量数据库 → 用户提问时向量检索 → 可选 Rerank 重排序 → LLM 流式生成回答。

---

## 技术栈

| 模块 | 技术 | 版本要求 |
|------|------|----------|
| 前端框架 | React + TypeScript | React 18 |
| 构建工具 | Vite | 5.x |
| CSS | Tailwind CSS | 4.x（使用 `@import "tailwindcss"` 语法） |
| 状态管理 | Zustand（带 persist 中间件） | 4.x |
| 路由 | react-router-dom | 6.x |
| HTTP 客户端 | Axios | |
| 图标 | @heroicons/react | |
| Markdown 渲染 | react-markdown + remark-gfm + @tailwindcss/typography | |
| 后端框架 | Python FastAPI | |
| ASGI 服务器 | uvicorn | |
| 向量数据库 | Milvus（standalone 模式） | 2.4.7 |
| Milvus 客户端 | pymilvus | 2.4.7 |
| Embedding/LLM | OpenAI SDK（兼容 OpenAI 和百炼 DashScope 接口） | openai 1.51.0 |
| PDF 解析 | pdfplumber | |
| DOCX 解析 | python-docx | |
| Token 计数 | tiktoken（cl100k_base 编码） | |
| 部署 | Docker Compose（etcd + MinIO + Milvus + App） | |

---

## 项目结构

```
knowledgebase/
├── backend/
│   ├── main.py                       # FastAPI 入口 + 静态文件托管
│   ├── config.py                     # 配置管理（settings.json > 环境变量 > 默认值）
│   ├── requirements.txt
│   ├── api/
│   │   ├── document.py               # 文档上传/列表/详情/删除
│   │   ├── query.py                  # 检索问答（普通 + SSE 流式）
│   │   └── settings.py               # API Key 配置（读取/保存/热更新）
│   ├── services/
│   │   ├── extract_service.py        # 文本抽取（PDF/DOCX/TXT/MD）
│   │   ├── clean_service.py          # 文本清洗
│   │   ├── chunk_service.py          # 分块策略（滑动窗口/语义/混合）
│   │   ├── embedding_service.py      # Embedding 生成（异步）
│   │   ├── llm_service.py            # LLM 调用（普通 + 流式，异步）
│   │   └── milvus_service.py         # Milvus 连接/写入/检索/删除
│   └── models/
│       └── schema.py                 # Pydantic 数据模型
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # 路由 + 侧边导航栏
│   │   ├── main.tsx                  # React 入口
│   │   ├── index.css                 # Tailwind 全局样式
│   │   ├── api/ragApi.ts             # 后端 API 封装（Axios + SSE 流式）
│   │   ├── store/appStore.ts         # Zustand 状态管理（含 localStorage 持久化）
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx        # 聊天窗口（流式输出 + Markdown 渲染）
│   │   │   ├── FileUploader.tsx      # 拖拽上传组件
│   │   │   └── SettingPanel.tsx      # 参数设置面板
│   │   └── pages/
│   │       ├── UploadPage.tsx        # 上传文档页
│   │       ├── DocumentListPage.tsx  # 文档列表页
│   │       ├── ChatPage.tsx          # 知识问答页
│   │       └── SettingsPage.tsx      # API Key 配置页
│   ├── vite.config.ts
│   └── package.json
├── deploy/
│   ├── docker-compose.yml            # 分发用（引用 Docker Hub 镜像）
│   └── install.sh                    # 一键安装脚本
├── Dockerfile                        # 多阶段构建
├── docker-compose.yml                # 开发用（本地构建）
├── Makefile
├── .gitignore
├── .dockerignore
└── .env.example
```

---

## 一、后端实现

### 1. 配置系统 (`config.py`)

实现三级配置优先级：`settings.json` > 环境变量 > 硬编码默认值。

```python
# 配置参数
OPENAI_API_KEY         # OpenAI API Key
OPENAI_BASE_URL        # 默认 https://api.openai.com/v1，支持自定义代理地址
OPENAI_EMBEDDING_MODEL # "text-embedding-3-small"
OPENAI_CHAT_MODEL      # "gpt-4o"

BAILIAN_API_KEY         # 百炼（通义千问）API Key
BAILIAN_BASE_URL        # "https://dashscope.aliyuncs.com/compatible-mode/v1"
BAILIAN_EMBEDDING_MODEL # "text-embedding-v1"
BAILIAN_CHAT_MODEL      # "qwen-plus"

# Embedding 维度映射（不同模型维度不同，需要分别建集合）
EMBEDDING_DIM = {"openai": 1536, "bailian": 768}

# Milvus 配置
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = int(os.getenv("MILVUS_PORT", "19530"))
MILVUS_COLLECTION = "rag_documents"

# HNSW 索引参数
HNSW_M = 16
HNSW_EF_CONSTRUCTION = 200
HNSW_EF = 64

# 默认分块参数
DEFAULT_CHUNK_SIZE = 500  # tokens
DEFAULT_OVERLAP = 100     # tokens
```

**热更新**：提供 `reload_from_settings()` 函数，POST `/api/settings` 后调用，立即生效无需重启。

**settings.json 加载**：启动时读取 `settings.json`（如不存在则跳过），格式：
```json
{
  "openai_api_key": "sk-...",
  "openai_base_url": "https://api.openai.com/v1",
  "bailian_api_key": "sk-..."
}
```

### 2. FastAPI 入口 (`main.py`)

```python
# 要点：
# - CORS 允许所有来源
# - 挂载三个路由: /api/document, /api/query, /api/settings
# - GET /api/health 健康检查
# - 全局异常处理器返回 traceback（方便调试）
# - 静态文件托管（Docker 模式）：
#   - 检查 backend/static/ 目录是否存在（Docker 构建时前端 dist 会复制到此处）
#   - 如存在，挂载 /assets 静态文件
#   - catch-all 路由 /{full_path:path} 返回 index.html（SPA 路由支持）
```

### 3. 文本抽取服务 (`extract_service.py`)

```python
def extract_text(file_path: str, file_type: str) -> str:
    # PDF: pdfplumber 逐页 extract_text()
    # DOCX: python-docx 逐段落 para.text
    # TXT/MD: UTF-8 直接读取
```

### 4. 文本清洗服务 (`clean_service.py`)

```python
def clean_text(text: str) -> str:
    # 1. 正则去除页码：匹配 "第X页"、"Page X"、"- X -" 等模式
    # 2. 去除控制字符（保留换行和 tab）
    # 3. 多个连续换行（3+）合并为 2 个
    # 4. 多个连续空格合并为 1 个
    # 5. 每行 strip
    # 6. 最终 strip
```

### 5. 分块服务 (`chunk_service.py`)

**三种分块模式**：

#### 滑动窗口 (`sliding`)
```python
def sliding_window_chunk(text, chunk_size=500, overlap=100):
    # 1. tiktoken (cl100k_base) 编码为 token 数组
    # 2. 滑动窗口：步长 = chunk_size - overlap
    # 3. 每个窗口解码回文本
    # 返回 list[str]
```

#### 语义分块 (`semantic`)
```python
async def semantic_chunk(text, model_provider="openai"):
    # 1. 取文本前 8000 字符
    # 2. Prompt："请按语义段落分块，返回 JSON: {\"chunks\": [...]}"
    # 3. 调用 LLM 解析
    # 4. 失败时回退到滑动窗口
```

#### 混合模式 (`hybrid`)
先语义分块，再对超长块进行滑动窗口裁剪。

**Token 计数**：使用 `tiktoken.get_encoding("cl100k_base")` 统计 token 数。

### 6. Embedding 服务 (`embedding_service.py`)

```python
# 全部使用 AsyncOpenAI 客户端（百炼 DashScope 兼容 OpenAI 接口格式）
async def generate_embedding(text: str, model_provider: str) -> list[float]:
    # 单条文本 → 单个 embedding 向量

async def generate_embeddings(texts: list[str], model_provider: str) -> list[list[float]]:
    # 批量文本 → 批量 embedding

# 代理支持：检测 http_proxy/https_proxy 环境变量，自动配置 httpx.AsyncClient
```

### 7. LLM 服务 (`llm_service.py`)

```python
async def call_llm(messages, model_provider, temperature=0.7) -> str:
    # 通用 LLM 调用，返回完整文本

async def generate_answer(question, contexts, model_provider) -> tuple[str, str]:
    # RAG 问答，返回 (answer, full_prompt)
    # System prompt: "你是一个知识库问答助手。请根据提供的参考资料回答用户问题。如果参考资料中没有相关信息，请如实告知。不要编造信息。"
    # User prompt: "参考资料：\n{contexts}\n\n问题：\n{question}"

async def stream_answer(question, contexts, model_provider) -> tuple[AsyncGenerator, str]:
    # 同上，但 stream=True，返回异步生成器逐块 yield 文本
```

### 8. Milvus 服务 (`milvus_service.py`)

#### 集合 Schema

每个 model_provider 单独一个集合（因 embedding 维度不同）：
- 集合名：`rag_documents_{model_provider}`（如 `rag_documents_openai`）

```python
fields = [
    FieldSchema("id", INT64, is_primary=True, auto_id=True),
    FieldSchema("doc_id", VARCHAR, max_length=256),
    FieldSchema("content", VARCHAR, max_length=65535),
    FieldSchema("vector", FLOAT_VECTOR, dim=1536 或 768),
]
```

#### HNSW 索引

```python
index_params = {
    "index_type": "HNSW",
    "metric_type": "COSINE",
    "params": {"M": 16, "efConstruction": 200},
}
# 搜索时 params: {"ef": 64}
```

#### 核心方法

```python
def get_or_create_collection(model_provider) -> Collection:
    # 懒初始化：不存在则创建 + 建索引 + load

def insert_chunks(doc_id, chunks, vectors, model_provider):
    # 批量插入 + flush

def search_chunks(query_vector, model_provider, top_k=5) -> list[dict]:
    # COSINE 搜索，返回 [{content, score, doc_id}]

def delete_doc_chunks(doc_id, model_provider):
    # 按 doc_id 删除所有分块 + flush

def get_doc_chunks(doc_id, model_provider) -> list[dict]:
    # 查询文档所有分块（用于前端展示）
```

### 9. 数据模型 (`schema.py`)

```python
class UploadRequest(BaseModel):
    chunk_mode: str = "sliding"       # "sliding" | "semantic" | "hybrid"
    chunk_size: int = 500             # 50-5000
    overlap: int = 100                # 0 to chunk_size-1
    model_provider: str = "openai"    # "openai" | "bailian"

class QueryRequest(BaseModel):
    question: str
    model_provider: str = "openai"
    top_k: int = 5
    use_rerank: bool = True

class RetrievalHit(BaseModel):
    content: str
    score: float                      # COSINE 相似度 0-1
    rerank_score: Optional[float]     # LLM 打分 0-10

class QueryResponse(BaseModel):
    answer: str
    contexts: list[str]
    retrieval: Optional[list[RetrievalHit]]
    use_rerank: bool
    prompt: Optional[str]             # 发送给 LLM 的完整 prompt

class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    chunk_count: int
    status: str
    model_provider: str
    chunk_mode: str
    chunk_size: int
    overlap: int
```

### 10. 文档管理接口 (`api/document.py`)

```
POST /api/document/upload     (multipart/form-data: file + 参数)
GET  /api/document/list       → 返回所有文档
GET  /api/document/{doc_id}/chunks  → 返回分块详情 JSON
GET  /api/document/{doc_id}/milvus  → 返回 Milvus 中的存储数据
DELETE /api/document/{doc_id}       → 删除文档 + Milvus 向量 + 分块文件
```

**上传处理流程**：
1. 保存文件到 `uploads/{uuid}.{ext}`
2. 抽取文本 → 清洗 → 分块
3. 批量生成 Embedding
4. 插入 Milvus
5. 保存分块结果为 JSON + Markdown 文件到 `chunk_results/`
6. 记录到内存字典 `_documents`

**分块结果文件保存**：
- `chunk_results/{doc_id}.json`：结构化数据，含每个分块的文本、token 数、embedding 前 8 维
- `chunk_results/{doc_id}.md`：人类可读的 Markdown 格式

**注意**：文档列表仅存内存，后端重启后丢失（但 Milvus 中的向量数据持久保留）。

### 11. 检索问答接口 (`api/query.py`)

#### POST /api/query（一次性返回）

处理流程：
1. 生成 query embedding
2. Milvus 向量搜索（COSINE, top_k）
3. 可选 Rerank：LLM 对每个分块打 0-10 分，按分数重排
4. 取 top 结果的文本作为 contexts
5. 调用 LLM 生成回答
6. 返回 QueryResponse

#### POST /api/query/stream（SSE 流式）

同样的检索流程，但回答部分使用 SSE 流式输出。

**SSE 协议格式**：

```
event: metadata
data: {"retrieval": [...], "contexts": [...], "use_rerank": true, "prompt": "..."}

event: delta
data: {"content": "这是"}

event: delta
data: {"content": "一段回答"}

event: done
data: {}
```

实现方式：FastAPI 的 `StreamingResponse(media_type="text/event-stream")`，设置 `Cache-Control: no-cache` 和 `X-Accel-Buffering: no`。

#### Rerank 实现

```python
async def rerank_chunks(question, chunks, model_provider):
    # Prompt: "请对以下段落与问题的相关性打分（0-10），返回 JSON: {\"scores\": [...]}"
    # 调用 LLM 解析 JSON
    # 按分数降序排列
    # 失败时保持原始顺序
```

### 12. 设置接口 (`api/settings.py`)

```
GET  /api/settings  → 返回配置（API Key 脱敏显示：sk-XXXX****XXXX）
POST /api/settings  → 保存到 settings.json + 调用 reload_from_settings() 热更新
```

**脱敏规则**：保留前 4 位和后 4 位，中间用 `****` 替代。保存时忽略包含 `*` 的值（表示用户未修改）。

---

## 二、前端实现

### 1. Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3050,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
```

### 2. 全局样式 (`index.css`)

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* 自定义滚动条、typing 动画等 */
```

**Typing 动画**：三个圆点交替上下跳动，用于 loading 状态。

### 3. 状态管理 (`appStore.ts`)

```typescript
// Zustand store
interface AppState {
  // 上传/查询设置
  modelProvider: "openai" | "bailian"  // 默认 "openai"
  chunkMode: "sliding" | "semantic" | "hybrid"  // 默认 "sliding"
  chunkSize: number      // 默认 500
  overlap: number        // 默认 100
  topK: number           // 默认 5
  useRerank: boolean     // 默认 true

  // 聊天记录（持久化到 localStorage）
  chatMessages: ChatMessage[]

  // Actions
  set*(): void
  setChatMessages(msgs): void
  updateLastMessage(partial): void      // 更新最后一条消息的部分字段
  appendToLastMessage(content): void    // 追加文本到最后一条消息
  clearChatMessages(): void
}

// persist 配置
persist({
  name: 'rag-knowledgebase-store',
  partialize: (state) => ({ chatMessages: state.chatMessages }),  // 只持久化聊天记录
})
```

### 4. API 客户端 (`ragApi.ts`)

**Axios 实例**：`baseURL: '/api'`

**常规接口**：
- `uploadDocument(file, options)` → POST multipart
- `getDocuments()` → GET
- `getDocChunks(docId)` → GET
- `getDocMilvus(docId)` → GET
- `deleteDocument(docId)` → DELETE
- `getSettings()` → GET
- `saveSettings(data)` → POST
- `queryKnowledge(data)` → POST

**SSE 流式接口**：
```typescript
async function queryKnowledgeStream(
  question: string,
  options: { model_provider, top_k, use_rerank },
  callbacks: {
    onMetadata: (data) => void,   // 收到检索结果
    onDelta: (content) => void,   // 收到文本增量
    onDone: () => void,           // 流结束
    onError: (error) => void,     // 出错
  }
) {
  // 1. fetch POST /api/query/stream
  // 2. reader = response.body.getReader()
  // 3. 逐行解析 SSE：
  //    - "event: xxx" → 记录当前事件类型
  //    - "data: xxx"  → JSON.parse 后调用对应回调
  // 4. 处理 buffer（跨 chunk 的不完整行）
}
```

**RetrievalHit 类型导出**：供 store 和 ChatWindow 使用。

### 5. 根组件 (`App.tsx`)

**布局**：左侧固定侧边栏（w-60）+ 右侧内容区。

**侧边栏**：
- 顶部 Logo："RAG 知识库"
- 导航链接（使用 NavLink，当前页高亮）：
  - 上传文档 → `/`（DocumentArrowUpIcon）
  - 文档列表 → `/documents`（DocumentTextIcon）
  - 知识问答 → `/chat`（ChatBubbleLeftRightIcon）
  - API 配置 → `/settings`（Cog6ToothIcon）
- 底部 Footer："Powered by RAG"

**路由**：
```
/           → UploadPage
/documents  → DocumentListPage
/chat       → ChatPage
/settings   → SettingsPage
```

### 6. 上传页面 (`UploadPage.tsx`)

布局：SettingPanel + FileUploader 上下排列。

### 7. 文档列表页面 (`DocumentListPage.tsx`)

**功能**：
- 文档列表表格：ID、文件名、模型、分块模式、分块数、状态、操作
- 刷新按钮
- 操作按钮：查看详情（弹窗）、删除
- **弹窗**（Modal）：两个 Tab
  - "分块详情"：显示元数据 + 每个分块内容/token 数/embedding 前 8 维
  - "Milvus 数据"：显示集合 schema、索引配置、记录数据

### 8. 知识问答页面 (`ChatPage.tsx`)

布局：标题栏 + 可折叠设置面板 + ChatWindow。

### 9. 设置页面 (`SettingsPage.tsx`)

**分组**：
- OpenAI：API Key 输入框 + Base URL 输入框
- 百炼（通义千问）：API Key 输入框
- 保存按钮 + 成功/失败反馈

### 10. 聊天窗口组件 (`ChatWindow.tsx`)

**核心功能**：
- 用户消息：右对齐，蓝色背景，纯文本
- AI 回答：左对齐，灰色背景，**使用 ReactMarkdown + remarkGfm 渲染 Markdown**
  - 配合 Tailwind `prose prose-sm` 样式类
- 每条 AI 回答下方可展开「检索过程」：
  - Pipeline 可视化标签：Embedding → 向量检索 Top N → (Rerank 重排) → LLM 生成
  - 可展开查看"拼接后的提示词"
  - 检索命中列表：每条显示排名、相似度百分比、Rerank 分数、内容预览
- Loading 状态：三个圆点跳动动画
- 输入区域：清空聊天按钮（垃圾桶图标）+ 输入框 + 发送按钮
- 自动滚动到最新消息

**流式输出流程**：
1. 用户发送消息 → 追加 user message 到 store
2. 追加空的 assistant message
3. 调用 `queryKnowledgeStream`
4. `onMetadata` → 更新最后一条消息的 retrieval/contexts/prompt
5. `onDelta` → 追加文本到最后一条消息的 content
6. `onDone` → 关闭 loading

### 11. 文件上传组件 (`FileUploader.tsx`)

- 拖拽上传区域（蓝色虚线边框，hover 高亮）
- 点击选择文件
- 支持格式：.pdf, .docx, .txt, .md
- 显示文件名 + 大小（KB）
- 上传按钮 + loading 状态
- 结果反馈（成功：doc_id + chunk_count / 失败：错误信息）

### 12. 设置面板组件 (`SettingPanel.tsx`)

**三列布局的分块模式选择**：
- 滑动窗口：按固定 token 窗口滑动切分
- 语义分块：由大模型按语义自动划分
- 混合模式：先语义分块再滑动裁剪

**设置项网格**：
- 模型选择下拉框：OpenAI / 百炼
- 分块大小输入（语义模式下隐藏）
- 重叠 token 数输入（语义模式下隐藏）
- Top K 输入
- Rerank 开关（toggle switch）

---

## 三、Docker 部署

### Dockerfile（多阶段构建）

```dockerfile
# Stage 1: 构建前端
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python 后端 + 前端静态文件
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir "setuptools<71" && \
    pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static
RUN mkdir -p uploads chunk_results
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**注意**：`setuptools<71` 是必须的，因为 Python 3.13 slim 不含 setuptools，而 71+ 版本移除了 `pkg_resources`（pymilvus 依赖它）。同时 `requirements.txt` 中需要 `marshmallow<4`（因为 4.x 与 environs 不兼容）。

### docker-compose.yml（开发用）

```yaml
services:
  etcd:
    image: quay.io/coreos/etcd:v3.5.18
    # 配置：ETCD_AUTO_COMPACTION_MODE, ETCD_QUOTA_BACKEND_BYTES 等
    # 健康检查：etcdctl endpoint health

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    # 默认账号：minioadmin:minioadmin
    # 健康检查：curl /minio/health/live

  milvus:
    image: milvusdb/milvus:v2.4.7
    command: ["milvus", "run", "standalone"]
    # 环境变量指向 etcd 和 minio
    # 依赖 etcd 和 minio healthy
    # 健康检查：curl localhost:9091/healthz（start_period: 90s）

  app:
    build: .
    image: your-dockerhub-username/rag-knowledgebase:latest
    ports: ["8000:8000"]
    environment:
      MILVUS_HOST: milvus
      MILVUS_PORT: "19530"
    volumes:
      - app_uploads:/app/uploads
      - app_chunks:/app/chunk_results
    depends_on:
      milvus:
        condition: service_healthy
```

### deploy/docker-compose.yml（分发用）

与开发版相同，但 app 服务不含 `build:`，只有 `image:`。所有服务加 `restart: unless-stopped`。Milvus 端口不映射到宿主机（仅内部通信）。

### deploy/install.sh（一键安装脚本）

```bash
#!/bin/bash
# 检查 Docker 和 Docker Compose
# 创建目录，下载 docker-compose.yml
# docker compose up -d
# 打印访问地址和常用命令
```

### Makefile

```makefile
IMAGE := your-dockerhub-username/rag-knowledgebase
TAG   := latest

build:
	docker build -t $(IMAGE):$(TAG) .
push: build
	docker push $(IMAGE):$(TAG)
dev:
	docker compose up -d
```

---

## 四、Git 配置

### .gitignore

```
.env
settings.json
venv/
__pycache__/
node_modules/
dist/
uploads/*
!uploads/.gitkeep
chunk_results/*
!chunk_results/.gitkeep
static/
*.pyc
```

### .dockerignore

```
.git
.env
settings.json
node_modules
venv
__pycache__
uploads/*
chunk_results/*
*.pyc
```

### .env.example

```bash
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
BAILIAN_API_KEY=sk-your-bailian-api-key
MILVUS_HOST=localhost
MILVUS_PORT=19530
```

---

## 五、UI 设计要求

- 整体风格：简洁现代，白色背景 + 灰色边框 + 蓝色主题色
- 侧边栏：固定左侧 w-60，白色背景，当前页导航高亮为蓝色
- 所有页面使用 Tailwind CSS 实现，响应式
- 聊天气泡：用户蓝色靠右，AI 灰色靠左
- 卡片/面板使用 rounded-xl + shadow-sm + border
- 按钮交互：hover 变色、active 缩放、disabled 灰色
- 自定义滚动条（窄、圆角）

---

## 六、关键设计决策说明

1. **每个模型提供商独立 Milvus 集合**：OpenAI embedding 1536 维，百炼 768 维，维度不同必须分开。
2. **Token 级分块**：使用 tiktoken 而非字符数，与 LLM token 计费一致。
3. **HNSW 索引 + COSINE 度量**：HNSW 提供快速近似最近邻搜索，COSINE 适合文本语义匹配。
4. **SSE 而非 WebSocket**：SSE 更简单，单向推送足够，兼容性好。
5. **热更新 API Key**：通过 settings.json + reload 函数，改 Key 无需重启。
6. **聊天记录仅存浏览器 localStorage**：轻量方案，不增加后端负担。
7. **文档列表仅存内存**：简化实现，重启后丢失（向量数据不丢）。
8. **Rerank 可选**：默认开启但可关闭，减少 API 调用成本。
