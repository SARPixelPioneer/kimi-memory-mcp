/**
 * ChromaDB HTTP 客户端封装
 * 连接 Docker 运行的 ChromaDB 服务器
 */

import { ChromaClient, Collection, IncludeEnum, DefaultEmbeddingFunction } from 'chromadb';

// ChromaDB 服务器地址
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

// Collection 名称
const COLLECTION_NAME = 'kimi_memory';

// 客户端单例
let client: ChromaClient | null = null;
let collection: Collection | null = null;

/**
 * 获取ChromaDB客户端
 */
export async function getClient(): Promise<ChromaClient> {
  if (!client) {
    client = new ChromaClient({
      path: CHROMA_URL,
    });
  }
  return client;
}

/**
 * 获取或创建Collection
 * 注意：每次调用都重新获取，避免缓存问题
 */
export async function getCollection(): Promise<Collection> {
  const chromaClient = await getClient();
  
  // 使用默认embedding function（我们不会用它，因为使用Ollama生成embedding）
  const embedder = new DefaultEmbeddingFunction();
  
  try {
    // 尝试获取已存在的collection
    return await chromaClient.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embedder,
    });
  } catch {
    // 如果不存在则创建
    return await chromaClient.createCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embedder,
      metadata: {
        description: 'Kimi Code CLI Memory Storage',
        created_at: new Date().toISOString(),
      },
    });
  }
}

/**
 * 文档元数据接口
 */
export interface DocumentMetadata {
  source: string;           // 文件路径
  description: string;      // 用户提供的描述
  chunk_index: number;      // 切片序号
  chunk_type: string;       // 切片类型 (function/class/module/text)
  file_type: string;        // 文件类型
  created_at: string;       // 创建时间
  start_line?: number;      // 起始行号
  end_line?: number;        // 结束行号
}

/**
 * 添加文档到向量库
 */
export async function addDocuments(
  contents: string[],
  embeddings: number[][],
  metadatas: DocumentMetadata[]
): Promise<void> {
  const coll = await getCollection();
  
  // 生成唯一ID
  const ids = metadatas.map((meta, index) => {
    const hash = Buffer.from(meta.source + meta.chunk_index).toString('base64url');
    return `${hash}_${index}_${Date.now()}`;
  });
  
  await coll.add({
    ids,
    documents: contents,
    embeddings,
    metadatas: metadatas as unknown as Record<string, string | number | boolean>[],
  });
}

/**
 * 搜索相似文档
 */
export interface SearchResult {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  distance: number;
}

export async function searchSimilar(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: Partial<DocumentMetadata>
): Promise<SearchResult[]> {
  const coll = await getCollection();
  
  // 构建where条件
  let whereClause: Record<string, unknown> | undefined;
  if (filter) {
    whereClause = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined) {
        whereClause[key] = value;
      }
    }
  }
  
  const results = await coll.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
    where: whereClause,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
  });
  
  const searchResults: SearchResult[] = [];
  
  if (results.ids && results.ids[0]) {
    for (let i = 0; i < results.ids[0].length; i++) {
      searchResults.push({
        id: results.ids[0][i],
        content: (results.documents?.[0]?.[i]) || '',
        metadata: (results.metadatas?.[0]?.[i] || {}) as unknown as DocumentMetadata,
        distance: (results.distances?.[0]?.[i]) || 0,
      });
    }
  }
  
  return searchResults;
}

/**
 * 列出所有已学习的文件（去重）
 */
export async function listSources(): Promise<Array<{ source: string; description: string; chunks: number; updated_at: string }>> {
  const coll = await getCollection();
  
  // 获取所有文档
  const allDocs = await coll.get({
    include: [IncludeEnum.Metadatas],
  });
  
  // 按source分组统计
  const sourceMap = new Map<string, { description: string; chunks: number; updated_at: string }>();
  
  if (allDocs.metadatas) {
    for (const metadata of allDocs.metadatas) {
      const meta = metadata as unknown as DocumentMetadata;
      const existing = sourceMap.get(meta.source);
      
      if (existing) {
        existing.chunks += 1;
        if (meta.created_at > existing.updated_at) {
          existing.updated_at = meta.created_at;
        }
      } else {
        sourceMap.set(meta.source, {
          description: meta.description,
          chunks: 1,
          updated_at: meta.created_at,
        });
      }
    }
  }
  
  return Array.from(sourceMap.entries()).map(([source, info]) => ({
    source,
    ...info,
  }));
}

/**
 * 删除指定文件的所有记忆
 */
export async function deleteBySource(source: string): Promise<number> {
  const coll = await getCollection();
  
  // 先查询该source的所有文档
  const docs = await coll.get({
    where: { source },
    include: [],
  });
  
  if (docs.ids && docs.ids.length > 0) {
    await coll.delete({
      ids: docs.ids,
    });
    return docs.ids.length;
  }
  
  return 0;
}

/**
 * 获取Collection统计信息
 */
export async function getStats(): Promise<{ total_documents: number; sources: number }> {
  const coll = await getCollection();
  const sources = await listSources();
  
  return {
    total_documents: sources.reduce((sum, s) => sum + s.chunks, 0),
    sources: sources.length,
  };
}

/**
 * 检查ChromaDB连接状态
 */
export async function checkChromaHealth(): Promise<boolean> {
  try {
    const client = await getClient();
    await client.listCollections();
    return true;
  } catch {
    return false;
  }
}
