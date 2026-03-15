/**
 * search_memory 工具
 * 检索记忆
 */

import { generateEmbedding, checkOllamaHealth } from '../utils/ollama.js';
import { searchSimilar, SearchResult } from '../store/chroma.js';

export interface SearchMemoryArgs {
  query: string;
  limit?: number;
  file_type?: string;
  source?: string;
}

export interface SearchMemoryResult {
  success: boolean;
  results?: Array<{
    content: string;
    source: string;
    description: string;
    chunk_type: string;
    relevance: number;
    lines?: string;
  }>;
  error?: string;
}

/**
 * 执行记忆检索
 */
export async function searchMemory(args: SearchMemoryArgs): Promise<SearchMemoryResult> {
  try {
    // 1. 检查Ollama服务
    const isHealthy = await checkOllamaHealth();
    if (!isHealthy) {
      return {
        success: false,
        error: 'Ollama服务未运行，请先启动Ollama',
      };
    }

    // 2. 生成查询的Embedding
    const queryEmbedding = await generateEmbedding(args.query);

    // 3. 构建过滤条件
    const filter: Partial<{ file_type: string; source: string }> = {};
    if (args.file_type) {
      filter.file_type = args.file_type;
    }
    if (args.source) {
      filter.source = args.source;
    }

    // 4. 搜索相似文档
    const limit = args.limit || 5;
    const results = await searchSimilar(
      queryEmbedding,
      limit,
      Object.keys(filter).length > 0 ? filter : undefined
    );

    if (results.length === 0) {
      return {
        success: true,
        results: [],
      };
    }

    // 5. 格式化结果
    const formattedResults = results.map(r => ({
      content: r.content,
      source: r.metadata.source,
      description: r.metadata.description,
      chunk_type: r.metadata.chunk_type,
      relevance: Math.round((1 - r.distance) * 100), // 转换为百分比相似度
      lines: r.metadata.start_line && r.metadata.end_line 
        ? `${r.metadata.start_line}-${r.metadata.end_line}` 
        : undefined,
    }));

    return {
      success: true,
      results: formattedResults,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `检索过程中发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 工具Schema定义
 */
export const searchMemorySchema = {
  name: 'search_memory',
  description: '在已学习的知识库中搜索相关内容。当你需要回忆之前学习过的文件内容时，使用此工具进行检索。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '搜索查询，描述你想找什么内容。',
      },
      limit: {
        type: 'number',
        description: '返回结果的最大数量（默认5条）。',
        default: 5,
      },
      file_type: {
        type: 'string',
        description: '按文件类型过滤（例如：py, js, ts, md）。',
      },
      source: {
        type: 'string',
        description: '按特定文件路径过滤。',
      },
    },
    required: ['query'],
  },
};
