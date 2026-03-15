# Kimi Memory MCP

为 Kimi Code CLI 打造的智能记忆系统，让大模型拥有持久化记忆能力。

## 功能特性

- 📚 **文件学习** - 学习代码、文档、会议记录等各种文件
- 🔍 **智能检索** - 使用自然语言查询已学习内容
- 🧠 **混合存储** - 同时存储原始内容和 AI 整理后的结构化内容
- 🤖 **智能预处理** - 自动调用 DeepSeek 整理复杂文档
- 🔒 **本地 Embedding** - 使用 Ollama + bge-m3，保护隐私
- 💾 **持久化存储** - 数据存储在 ChromaDB，重启不丢失

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  Kimi Code CLI                                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Memory MCP Server (Node.js + TypeScript)               │
│  ├── embed_file     - 学习文件                          │
│  ├── search_memory  - 检索记忆                          │
│  ├── list_memories  - 列出记忆                          │
│  └── forget_file    - 删除记忆                          │
└──────────────────┬──────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌─────────────┐         ┌─────────────┐
│   Ollama    │         │  DeepSeek   │
│  (bge-m3)   │         │    API      │
│  Embedding  │         │  内容整理   │
└──────┬──────┘         └─────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  ChromaDB (Docker)                                      │
│  └── 向量存储 + 元数据                                    │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/kimi-memory-mcp.git
cd kimi-memory-mcp
```

### 2. 安装依赖

```bash
npm install
npm run build
```

### 3. 启动 ChromaDB

```bash
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
```

### 4. 配置 MCP

编辑 `~/.kimi/mcp.json`：

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/kimi-memory-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_AUTH_TOKEN": "your-deepseek-api-key",
        "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
        "ANTHROPIC_MODEL": "deepseek-chat"
      }
    }
  }
}
```

### 5. 重启 Kimi CLI

重启 Kimi Code CLI 后，记忆功能即可使用。

## 使用方法

### 学习文件

```
> 学习 /path/to/auth.js，用户认证模块
> 学习 /path/to/API设计.md，后端接口规范
> 学习 /path/to/周会.md，本周开发计划
```

### 检索记忆

```
> 回忆一下用户登录怎么实现
> 上周会议说的待办事项有哪些
> 之前学习的认证相关代码在哪里
```

### 管理记忆

```
> 查看我已让你学习的所有文件
> 忘记 /path/to/旧文件.js
```

## 项目结构

```
kimi-memory-mcp/
├── src/
│   ├── index.ts              # MCP 服务器入口
│   ├── tools/
│   │   ├── embed.ts          # 学习文件
│   │   ├── search.ts         # 检索记忆
│   │   ├── list.ts           # 列出记忆
│   │   └── forget.ts         # 删除记忆
│   ├── store/
│   │   └── chroma_http.ts    # ChromaDB HTTP 客户端
│   └── utils/
│       ├── ollama.ts         # Ollama API 封装
│       ├── deepseek.ts       # DeepSeek API 封装
│       └── splitter.ts       # 文件切片器
├── dist/                     # 编译后的 JS
├── package.json
├── tsconfig.json
└── README.md
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ANTHROPIC_AUTH_TOKEN` | DeepSeek API Key | 必填 |
| `ANTHROPIC_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com/anthropic` |
| `ANTHROPIC_MODEL` | 使用的模型 | `deepseek-chat` |
| `CHROMA_URL` | ChromaDB 地址 | `http://localhost:8000` |
| `OLLAMA_HOST` | Ollama 地址 | `http://localhost:11434` |

## 技术亮点

### 1. 混合存储

同时存储原始内容和 AI 整理后的结构化内容：
- 检索时优先匹配结构化内容（更准确）
- 需要细节时查看原始内容（更完整）

### 2. 智能预处理

自动判断文件类型：
- 代码文件（.py, .js, .ts等）→ 直接切片
- 文档类（.md, .txt）→ DeepSeek 整理后存储

### 3. 本地 Embedding

使用 Ollama 本地运行 bge-m3 模型：
- 无需联网即可生成向量
- 保护数据隐私
- 免费使用

## 依赖要求

- Node.js >= 18
- Docker (用于运行 ChromaDB)
- Ollama (本地 Embedding 服务)
- DeepSeek API Key (文档预处理)

## 安装依赖服务

### Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# 下载安装包: https://ollama.com/download/windows
```

### 拉取 bge-m3 模型

```bash
ollama pull bge-m3
```

## 开发

```bash
# 开发模式（自动编译）
npm run dev

# 构建
npm run build

# 测试连接
node dist/index.js
```

## 许可证

MIT License

## 致谢

- [Kimi Code CLI](https://kimi.moonshot.cn/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Ollama](https://ollama.com/)
- [ChromaDB](https://www.trychroma.com/)
- [DeepSeek](https://www.deepseek.com/)
