# RAG 知识库系统

基于 RAG（Retrieval-Augmented Generation）架构的知识库问答系统。支持文档上传、智能分块、向量检索、Rerank 重排序、LLM 流式回答，解决长文档无法完整输入模型、LLM 幻觉、检索质量不稳定等问题。

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand |
| 后端 | Python FastAPI |
| 向量数据库 | Milvus (HNSW 索引) |
| Embedding | OpenAI `text-embedding-3-small` / 百炼 `text-embedding-v1` |
| LLM | OpenAI `gpt-4o` / 百炼 `qwen-plus` |
| 文档解析 | pdfplumber / python-docx |
| 部署 | Docker Compose（一键启动） |

## 系统架构

```
Frontend (React SPA)
         |
         v
   FastAPI Backend ─── 流式 SSE 输出
         |
    +----+----+
    |         |
    v         v
 文档处理    查询问答
 Pipeline   Pipeline
    |         |
    v         v
  Milvus (向量存储与检索)
```

### 文档处理流程

```
上传文档 (PDF/DOCX/TXT/MD)
    → 文本抽取 (pdfplumber / python-docx)
    → 文本清洗 (去页码、噪音字符、多余换行)
    → 智能分块 (滑动窗口 / LLM 语义分块 / 混合模式)
    → 生成 Embedding
    → 写入 Milvus
```

### 查询问答流程

```
用户提问
    → 生成 Query Embedding
    → Milvus 向量检索 (HNSW, COSINE, top_k)
    → Rerank 重排序 (可选, LLM 打分 0-10)
    → 拼接上下文 + Prompt
    → LLM 流式生成回答 (SSE)
```

## 快速开始

### 方式一：Docker 一键部署（推荐）

只需安装 [Docker](https://docs.docker.com/get-docker/)，无需任何其他依赖。

```bash
# 下载配置文件并启动
curl -fsSL https://raw.githubusercontent.com/DAgogo04/Basic-Rag/main/deploy/install.sh | bash
```

或者手动操作：

```bash
# 下载 docker-compose.yml
mkdir rag-knowledgebase && cd rag-knowledgebase
curl -fsSL https://raw.githubusercontent.com/DAgogo04/Basic-Rag/main/deploy/docker-compose.yml -o docker-compose.yml

# 启动全部服务（Milvus + 应用）
docker compose up -d
```

启动完成后：

1. 访问 **http://localhost:8000**
2. 点击侧边栏「**API 配置**」，填入 OpenAI 或通义千问的 API Key
3. 开始上传文档和问答

```bash
# 常用命令
docker compose logs -f      # 查看日志
docker compose down          # 停止服务
docker compose up -d         # 重新启动
```

### 方式二：本地开发

#### 前置依赖

- Python >= 3.10
- Node.js >= 18
- Milvus >= 2.4（需提前启动）

#### 启动 Milvus

```bash
wget https://github.com/milvus-io/milvus/releases/download/v2.4.7/milvus-standalone-docker-compose.yml -O docker-compose.yml
docker compose up -d
```

#### 启动后端

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:3050`，通过 Vite 代理将 `/api` 请求转发到后端。

#### 配置 API Key

**方式 A：Web 页面配置（推荐）** — 访问侧边栏「API 配置」页面，填入 Key 后保存。配置持久化在 `backend/settings.json`，优先级高于环境变量。

**方式 B：环境变量** — 创建 `backend/.env` 文件：

```bash
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1    # 可选，可填代理地址
BAILIAN_API_KEY=sk-xxxxxxxx                   # 通义千问
```

## 使用指南

1. **API 配置** — 在「API 配置」页面填入你的 API Key
2. **上传文档** — 进入「上传文档」页面，选择文件（PDF/DOCX/TXT/MD），配置分块模式和模型，点击上传
3. **查看文档** — 在「文档列表」页面查看已上传的文档及其分块信息，支持删除
4. **问答检索** — 进入「知识问答」页面，输入问题，系统自动检索相关文档并以流式方式生成回答。展开「检索过程」可查看每条结果的相似度分数和 Rerank 分数

## 项目结构

```
knowledgebase/
├── backend/
│   ├── main.py                       # FastAPI 入口, 静态文件托管
│   ├── config.py                     # 全局配置 (settings.json > 环境变量)
│   ├── settings.json                 # API Key 持久化配置 (运行时生成)
│   ├── api/
│   │   ├── document.py               # 文档上传/列表/删除接口
│   │   ├── query.py                  # 检索问答接口 (含 SSE 流式)
│   │   └── settings.py               # API Key 配置接口
│   ├── services/
│   │   ├── extract_service.py        # 文本抽取 (PDF/DOCX/TXT/MD)
│   │   ├── clean_service.py          # 文本清洗
│   │   ├── chunk_service.py          # 分块策略 (滑动窗口/语义/混合)
│   │   ├── embedding_service.py      # Embedding 生成 (OpenAI/百炼)
│   │   ├── milvus_service.py         # Milvus 连接/写入/检索/删除
│   │   └── llm_service.py            # LLM 调用 (普通 + 流式)
│   ├── models/
│   │   └── schema.py                 # Pydantic 数据模型
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # 路由 + 侧边导航栏
│   │   ├── api/ragApi.ts             # 后端 API 封装 (含 SSE 流式)
│   │   ├── store/appStore.ts         # 全局状态管理 (Zustand)
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx        # 文档上传页
│   │   │   ├── DocumentListPage.tsx  # 文档列表页
│   │   │   ├── ChatPage.tsx          # 问答页
│   │   │   └── SettingsPage.tsx      # API Key 配置页
│   │   └── components/
│   │       ├── FileUploader.tsx      # 文件上传组件
│   │       ├── ChatWindow.tsx        # 聊天窗口组件 (流式输出)
│   │       └── SettingPanel.tsx      # 参数设置面板
│   └── package.json
├── deploy/
│   ├── docker-compose.yml            # 分发用 (引用 Docker Hub 镜像)
│   └── install.sh                    # 一键安装脚本
├── docs/
│   └── tutorial.md                   # 教学文档
├── Dockerfile                        # 多阶段构建 (前端编译 + 后端)
├── docker-compose.yml                # 开发用 (本地构建镜像)
└── Makefile                          # 镜像构建与推送
```

## 配置说明

### 模型切换

系统支持两种模型，通过前端设置面板切换：

| 配置项 | OpenAI | 百炼 (通义千问) |
|--------|--------|-----------------|
| Embedding 模型 | `text-embedding-3-small` (1536 维) | `text-embedding-v1` (768 维) |
| Chat 模型 | `gpt-4o` | `qwen-plus` |
| API 地址 | `api.openai.com/v1` | `dashscope.aliyuncs.com/compatible-mode/v1` |

### 分块策略

| 模式 | 说明 |
|------|------|
| `sliding` | 滑动窗口 + overlap，按 token 数切分，默认 500 tokens / 100 overlap |
| `semantic` | LLM 语义分块，调用 LLM 按语义段落切分 |
| `hybrid` | 混合模式，先语义分块再对超长块滑动裁剪 |

### Milvus 索引参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 索引类型 | HNSW | 近似最近邻索引 |
| M | 16 | 每层最大连接数 |
| efConstruction | 200 | 构建索引时的搜索宽度 |
| ef | 64 | 查询时的搜索宽度 |
| metric | COSINE | 相似度度量方式 |

## API 接口

### 文档管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/document/upload` | 上传文档（multipart/form-data） |
| `GET` | `/api/document/list` | 获取文档列表 |
| `GET` | `/api/document/{doc_id}/chunks` | 查看文档分块详情 |
| `GET` | `/api/document/{doc_id}/milvus` | 查看文档在向量库中的存储数据 |
| `DELETE` | `/api/document/{doc_id}` | 删除文档及其向量数据 |

### 检索问答

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/query` | 一次性返回完整回答 |
| `POST` | `/api/query/stream` | SSE 流式返回（逐字输出） |

请求体：

```json
{
  "question": "什么是 RAG？",
  "model_provider": "openai",
  "top_k": 5,
  "use_rerank": true
}
```

### 系统配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/settings` | 获取当前配置（API Key 脱敏显示） |
| `POST` | `/api/settings` | 保存 API Key 配置（热更新，无需重启） |
| `GET` | `/api/health` | 服务健康检查 |

## 构建与发布

```bash
# 构建 Docker 镜像
make build

# 推送到 Docker Hub
make push

# 本地 Docker 开发启动
make dev
```

## 教学文档

详细的实现原理和代码解读请参阅 [docs/tutorial.md](docs/tutorial.md)，涵盖：

- 向量数据库安装与使用
- Embedding、分块、Rerank 原理
- 用户旅程：从上传文档到检索问答的完整链路
- 关键代码逐行解读
