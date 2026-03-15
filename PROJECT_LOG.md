# Kimi Memory MCP - 项目记录

> 本文件记录本项目的开发历程、配置信息和使用说明
> 项目地址：https://github.com/SARPixelPioneer/kimi-memory-mcp

---

## 项目概述

为 Kimi Code CLI 打造的智能记忆系统 MCP 服务器，让大模型拥有持久化记忆能力。

### 核心功能
- 📚 文件学习（代码、文档、会议记录等）
- 🔍 自然语言检索记忆
- 🧠 混合存储（原始内容 + AI 结构化内容）
- 🤖 DeepSeek 智能预处理
- 🔒 本地 Embedding（Ollama + bge-m3）
- 💾 持久化存储（ChromaDB）

---

## 开发历程

### 2026-03-15 项目启动

#### 需求分析
用户希望为 Kimi Code CLI 添加记忆功能：
- 能够学习指定的文件
- 持久化存储记忆
- 后续对话中随时检索

#### 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| Embedding | Ollama + bge-m3 | 本地运行，免费，中文效果好 |
| 向量数据库 | ChromaDB | 轻量级，Docker 部署 |
| 集成方式 | MCP | Kimi CLI 官方支持 |
| 预处理 | DeepSeek API | 复杂内容结构化 |

#### 架构设计
```
Kimi CLI → Memory MCP Server → Ollama (Embedding)
                          ↓
                    ChromaDB (存储)
                          ↑
                    DeepSeek (预处理)
```

### 实现过程

#### Phase 1: 基础架构
- 创建 MCP 服务器框架
- 实现文件切片策略（按函数/类切片）
- 集成 Ollama Embedding

#### Phase 2: 存储层
- 使用 ChromaDB HTTP 客户端
- Docker 运行 ChromaDB 服务
- 实现混合存储策略

#### Phase 3: 智能预处理
- 集成 DeepSeek API
- 自动判断是否需要预处理
- 代码文件直接存储，文档类结构化

#### Phase 4: 开源发布
- 完善 README 文档
- 添加 MIT 许可证
- 推送到 GitHub

---

## 环境配置

### 本地开发环境

#### 必需服务

1. **Ollama** (本地 Embedding)
   ```bash
   # 安装
   # Windows: https://ollama.com/download/windows
   
   # 拉取模型
   ollama pull bge-m3
   
   # 验证
   ollama list
   # 应显示: bge-m3:latest
   ```

2. **ChromaDB** (Docker)
   ```bash
   # 启动容器
   docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
   
   # 验证
   docker ps | grep chromadb
   ```

#### 配置文件

**MCP 配置** (`C:\Users\SQK\.kimi\mcp.json`):
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["D:\\Agent_working\\embedding\\kimi-memory-mcp\\dist\\index.js"],
      "env": {
        "ANTHROPIC_AUTH_TOKEN": "sk-c401b59fb9b94129b1df715feb1804e1",
        "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
        "ANTHROPIC_MODEL": "deepseek-chat"
      }
    }
  }
}
```

**环境变量** (`.env` 文件):
```bash
# DeepSeek API
ANTHROPIC_AUTH_TOKEN=sk-c401b59fb9b94129b1df715feb1804e1
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_MODEL=deepseek-chat

# ChromaDB (可选)
CHROMA_URL=http://localhost:8000

# Ollama (可选)
OLLAMA_HOST=http://localhost:11434
```

### 项目结构

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
│   │   ├── chroma_http.ts    # ChromaDB HTTP 客户端
│   │   ├── chroma.ts         # 存储接口
│   │   └── simple_memory.ts  # 简单内存存储（备用）
│   └── utils/
│       ├── ollama.ts         # Ollama API 封装
│       ├── deepseek.ts       # DeepSeek API 封装
│       └── splitter.ts       # 文件切片器
├── dist/                     # 编译输出
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── .env.example
├── .gitignore
└── PROJECT_LOG.md            # 本文件
```

---

## 使用方法

### 开发构建

```bash
# 进入项目目录
cd D:\Agent_working\embedding\kimi-memory-mcp

# 安装依赖
npm install

# 开发模式（自动编译）
npm run dev

# 构建
npm run build

# 测试运行
node dist/index.js
```

### 日常使用

在 Kimi Code CLI 中：

```bash
# 学习文件
> 学习 D:\项目\src\auth.js，用户认证模块
> 学习 D:\文档\API设计.md，后端接口规范
> 学习 D:\会议\周会.md，本周开发计划

# 检索记忆
> 回忆一下用户登录怎么实现
> 上周会议说的待办事项有哪些
> 之前学习的认证相关代码在哪里

# 管理记忆
> 查看我已让你学习的所有文件
> 忘记 D:\旧项目\test.js
```

---

## 技术细节

### 混合存储策略

每个文件切片生成两个存储条目：

1. **原始内容** (chunk_type: text/function/module)
   - 保留完整原文
   - 用于查看细节

2. **结构化内容** (chunk_type: *_structured)
   - DeepSeek 整理后的摘要
   - 包含：核心主题、关键要点、待办事项
   - 用于检索匹配

### 智能预处理判断

```typescript
function needsPreprocessing(content: string, fileExt: string): boolean {
  // 代码文件：不需要
  if (['.py', '.js', '.ts', '.java'].includes(fileExt)) return false;
  
  // 长文本（>1500字符）：需要
  if (content.length > 1500) return true;
  
  // 包含关键词：需要
  const keywords = ['会议', '讨论', '结论', '待办', '问题', '方案'];
  if (keywords.some(kw => content.includes(kw))) return true;
  
  return false;
}
```

### 数据存储位置

| 数据类型 | 存储位置 |
|---------|---------|
| 向量数据 | Docker 容器 `chromadb:/data/` |
| SQLite 数据库 | `/data/chroma.sqlite3` |
| 配置文件 | `~/.kimi/mcp.json` |

---

## 问题记录

### 已解决的问题

1. **ChromaDB 连接失败**
   - 原因：JS 客户端需要 HTTP 服务器
   - 解决：使用 Docker 运行 ChromaDB

2. **向量维度不匹配**
   - 原因：测试数据 5 维 vs bge-m3 1024 维
   - 解决：删除旧 Collection 重新创建

3. **MCP 服务器缓存**
   - 原因：修改代码后需重启 Kimi CLI
   - 解决：重启 Kimi Code CLI

4. **GitHub 分支问题**
   - 原因：默认 main 分支 vs master 分支
   - 解决：推送代码到 main 分支

---

## 版本历史

### v1.0.0 (2026-03-15)
- ✅ 基础 MCP 服务器框架
- ✅ 文件切片和 Embedding
- ✅ ChromaDB 向量存储
- ✅ DeepSeek 智能预处理
- ✅ 混合存储策略
- ✅ 开源发布到 GitHub

---

## 未来计划

- [ ] 增量更新（文件修改后只更新变更部分）
- [ ] 多项目隔离（按项目隔离记忆空间）
- [ ] 记忆过期（支持设置有效期）
- [ ] Web 界面（可视化管理和检索）
- [ ] GitHub Actions（自动测试和构建）

---

## 相关链接

- **GitHub 仓库**: https://github.com/SARPixelPioneer/kimi-memory-mcp
- **MCP 协议**: https://modelcontextprotocol.io/
- **Ollama**: https://ollama.com/
- **ChromaDB**: https://www.trychroma.com/
- **DeepSeek**: https://www.deepseek.com/

---

## 联系方式

如有问题或建议，欢迎通过 GitHub Issues 反馈。

---

*最后更新：2026-03-15*  
*作者：SARPixelPioneer*
