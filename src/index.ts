#!/usr/bin/env node

/**
 * Memory MCP Server
 * 基于Ollama和ChromaDB的文件记忆系统
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { embedFile, embedFileSchema } from './tools/embed.js';
import { searchMemory, searchMemorySchema } from './tools/search.js';
import { listMemories, listMemoriesSchema } from './tools/list.js';
import { forgetFile, forgetFileSchema } from './tools/forget.js';

// 创建MCP服务器
const server = new Server(
  {
    name: 'memory-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      embedFileSchema,
      searchMemorySchema,
      listMemoriesSchema,
      forgetFileSchema,
    ],
  };
});

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'embed_file': {
        const result = await embedFile(args as { file_path: string; description: string });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_memory': {
        const result = await searchMemory(args as { query: string; limit?: number; file_type?: string; source?: string });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_memories': {
        const result = await listMemories(args as { file_type?: string });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'forget_file': {
        const result = await forgetFile(args as { file_path: string });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Memory MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
