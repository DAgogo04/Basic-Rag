技术栈固定：

* 前端：React + TypeScript + Vite
* 后端：Python（FastAPI）
* 向量数据库：Milvus
* 模型支持：OpenAI + 百炼（兼容 OpenAI API 格式）

不写营销内容，不写多余扩展，只给完整可落地架构。

---

# 一、背景说明

在构建企业级 RAG（Retrieval-Augmented Generation）系统时，常见问题包括：

1. 长文档上下文无法完整输入模型
2. LLM 容易产生幻觉
3. 文档结构复杂，语义被切断
4. 检索结果质量不稳定

因此需要构建：

* 文档抽取与清洗流程
* 分块策略（滑动窗口 + 语义分块）
* 向量化与存储
* 高质量向量检索
* Rerank
* 统一模型接口（兼容 OpenAI / 百炼）

目标是实现一个：

> 可扩展、可切换模型、可配置分块策略的 RAG 系统

---

# 二、需求说明

## 1️⃣ 核心功能

### 文档管理

* 上传文档（pdf / docx / txt）
* 文档抽取与清洗
* 文档分块
* 生成 embedding
* 存入 Milvus

### 检索问答

* 用户输入问题
* 生成 query embedding
* Milvus 检索
* 可选 rerank
* 拼接上下文
* 调用 LLM 生成答案

### 分块策略支持

* 滑动窗口 + overlap
* LLM 语义分块
* 混合模式

### 模型兼容

* OpenAI
* 百炼（DashScope Compatible Mode）

---

# 三、系统整体架构

```
Frontend (React)
        ↓
FastAPI Backend
        ↓
Document Pipeline
   ├── 抽取
   ├── 清洗
   ├── 分块
   ├── Embedding
   └── 写入 Milvus
        ↓
Query Pipeline
   ├── Query Embedding
   ├── Milvus Search
   ├── Rerank
   └── LLM 生成
```

---

# 四、前端架构设计

技术栈：

* React
* TypeScript
* Vite
* Axios
* Zustand（状态管理）

---

## 前端模块划分

```
src/
 ├── pages/
 │    ├── UploadPage.tsx
 │    ├── DocumentListPage.tsx
 │    └── ChatPage.tsx
 ├── components/
 │    ├── FileUploader.tsx
 │    ├── ChatWindow.tsx
 │    └── SettingPanel.tsx
 ├── api/
 │    └── ragApi.ts
 └── store/
      └── appStore.ts
```

---

## 前端核心功能

### 1️⃣ 文档上传

* 上传文件
* 选择分块模式
* 选择模型（OpenAI / 百炼）
* 设置 chunk size / overlap

调用接口：

```
POST /api/document/upload
```

---

### 2️⃣ 问答页面

* 输入问题
* 展示召回内容
* 展示最终回答

调用接口：

```
POST /api/query
```

---

# 五、后端架构设计（Python）

技术栈：

* FastAPI
* pymilvus
* openai
* pdfplumber
* python-docx
* uvicorn

---

## 后端目录结构

```
backend/
 ├── main.py
 ├── config.py
 ├── api/
 │    ├── document.py
 │    └── query.py
 ├── services/
 │    ├── extract_service.py
 │    ├── clean_service.py
 │    ├── chunk_service.py
 │    ├── embedding_service.py
 │    ├── milvus_service.py
 │    └── llm_service.py
 └── models/
      └── schema.py
```

---

# 六、文档处理流程

---

## 1️⃣ 文本抽取

根据文件类型选择：

* pdf → pdfplumber
* docx → python-docx
* txt → 直接读取

抽取结果统一输出纯文本字符串。

---

## 2️⃣ 文本清洗

规则：

* 删除多余换行
* 删除页码
* 合并空格
* 删除噪音字符

输出：

```
clean_text: str
```

---

## 3️⃣ 分块策略

---

### 方案 A：滑动窗口 + overlap

参数：

```
chunk_size = 500 tokens
overlap = 100 tokens
```

输出：

```
List[str] chunks
```

---

### 方案 B：LLM 语义分块

流程：

1. 调用 LLM
2. 返回 JSON 格式分块
3. 校验长度
4. 超长再滑动裁剪

输出：

```
List[str] semantic_chunks
```

---

# 七、Embedding 服务设计

统一接口：

```
generate_embedding(text: str) -> List[float]
```

---

## OpenAI 模式

* model: text-embedding-3-small

---

## 百炼模式

* base_url: [https://dashscope.aliyuncs.com/compatible-mode/v1](https://dashscope.aliyuncs.com/compatible-mode/v1)
* model: text-embedding-v1

统一封装在：

```
embedding_service.py
```

通过配置切换：

```
MODEL_PROVIDER = "openai" | "bailian"
```

---

# 八、Milvus 设计

---

## Collection 设计

字段：

* id (int64)
* doc_id (varchar)
* content (varchar)
* vector (float_vector)

维度：

* 1536（OpenAI）
* 768（百炼）

---

## 索引类型

HNSW

参数：

```
M = 16
efConstruction = 200
metric = COSINE
```

---

## 写入流程

```
for chunk in chunks:
    embedding = generate_embedding(chunk)
    insert to milvus
```

---

# 九、查询流程

---

## 1️⃣ Query Embedding

```
vector = generate_embedding(query)
```

---

## 2️⃣ Milvus 搜索

参数：

```
ef = 64
limit = 5
```

返回：

```
top_k chunks
```

---

## 3️⃣ 可选 Rerank

可接：

* BGE reranker
* 百炼 rerank

---

## 4️⃣ 拼接 Prompt

结构：

```
参考资料：
1. chunk1
2. chunk2
3. chunk3

问题：
xxx
```

---

## 5️⃣ 调用 LLM 生成

支持：

* OpenAI GPT
* 百炼 Qwen

---

# 十、核心技术对比

| 模块        | 技术                |
| --------- | ----------------- |
| 前端        | React + TS + Vite |
| 后端        | FastAPI           |
| 向量数据库     | Milvus            |
| 索引        | HNSW              |
| Embedding | OpenAI / 百炼       |
| 分块        | 滑动窗口 + LLM        |
| 检索优化      | Rerank            |

---

# 十一、工程可扩展性

后续可以扩展：

* 多租户支持
* 文档权限控制
* Metadata 过滤检索
* Hybrid Search（关键词 + 向量）
* Agent 调度

---

# 十二、最终推荐默认配置

生产默认建议：

```
分块策略：滑动窗口 + overlap
chunk_size: 500
overlap: 100

Milvus:
M=16
efConstruction=200
ef=64

top_k=5
+ rerank
```

语义分块作为高级增强模式开启。

---

# 十三、完整系统流程总结

```
上传文档
    ↓
抽取
    ↓
清洗
    ↓
分块
    ↓
Embedding
    ↓
Milvus HNSW 存储
    ↓
用户提问
    ↓
Query Embedding
    ↓
Milvus 检索
    ↓
Rerank
    ↓
LLM 生成答案
```
