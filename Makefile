IMAGE := meroc/rag-knowledgebase
TAG   := latest

.PHONY: build push dev

## 构建镜像
build:
	docker build -t $(IMAGE):$(TAG) .

## 构建并推送到 Docker Hub
push: build
	docker push $(IMAGE):$(TAG)

## 本地开发启动
dev:
	docker compose up -d
