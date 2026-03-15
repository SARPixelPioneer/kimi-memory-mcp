/**
 * list_memories 工具
 * 列出已学习的文件
 */

import { listSources, getStats } from '../store/chroma.js';

export interface ListMemoriesArgs {
  file_type?: string;
}

export interface ListMemoriesResult {
  success: boolean;
  sources?: Array<{
    source: string;
    description: string;
    chunks: number;
    updated_at: string;
  }>;
  stats?: {
    total_documents: number;
    total_sources: number;
  };
  error?: string;
}

/**
 * 执行列出记忆
 */
export async function listMemories(args: ListMemoriesArgs): Promise<ListMemoriesResult> {
  try {
    // 1. 获取所有来源
    let sources = await listSources();

    // 2. 按文件类型过滤
    if (args.file_type) {
      sources = sources.filter(s => {
        const ext = s.source.split('.').pop()?.toLowerCase();
        return ext === args.file_type;
      });
    }

    // 3. 获取统计信息
    const stats = await getStats();

    // 4. 按更新时间排序（最新的在前）
    sources.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return {
      success: true,
      sources: sources.map(s => ({
        source: s.source,
        description: s.description,
        chunks: s.chunks,
        updated_at: s.updated_at,
      })),
      stats: {
        total_documents: stats.total_documents,
        total_sources: stats.sources,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `获取记忆列表时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 工具Schema定义
 */
export const listMemoriesSchema = {
  name: 'list_memories',
  description: '列出所有已学习的文件及其统计信息。当用户问"查看已学习的文件"、"显示记忆列表"、"都有什么文件"、"知识库里有什么"、"列出所有内容"、"查看记忆"时，使用此工具。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_type: {
        type: 'string',
        description: '按文件类型过滤（例如：py, js, ts, md）。',
      },
    },
    required: [],
  },
};
