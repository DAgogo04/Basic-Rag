#!/usr/bin/env bash
# ================================================================
#  RAG 知识库 — 一键安装脚本
#
#  用法:
#    curl -fsSL https://raw.githubusercontent.com/DAgogo04/Basic-Rag/main/deploy/install.sh | bash
#
#  或者下载后执行:
#    chmod +x install.sh && ./install.sh
# ================================================================

set -e

REPO_URL="https://raw.githubusercontent.com/DAgogo04/Basic-Rag/main/deploy"
INSTALL_DIR="rag-knowledgebase"

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║   RAG 知识库 — 一键安装           ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 未检测到 Docker，请先安装: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ 未检测到 Docker Compose，请升级 Docker 或安装 docker-compose-plugin"
    exit 1
fi

echo "✅ Docker 环境检测通过"

# 创建目录
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 下载 docker-compose.yml
echo "⬇️  下载配置文件..."
curl -fsSL "$REPO_URL/docker-compose.yml" -o docker-compose.yml

# 启动
echo "🚀 启动服务（首次拉取镜像可能需要几分钟）..."
docker compose up -d

echo ""
echo "✅ 安装完成！"
echo ""
echo "  📌 访问地址: http://localhost:8000"
echo "  📌 首次使用请点击侧边栏「API 配置」填入你的 API Key"
echo ""
echo "  常用命令:"
echo "    cd $INSTALL_DIR"
echo "    docker compose logs -f    # 查看日志"
echo "    docker compose down       # 停止服务"
echo "    docker compose up -d      # 重新启动"
echo ""
