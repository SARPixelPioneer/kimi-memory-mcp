/**
 * 简单内存存储 - 使用JSON文件
 * 轻量级实现，无需ChromaDB服务器
 */

import fs from 'fs/promises';
import path from 'path';

// 数据存储路径
const MEMORY_DIR = path.join(process.env.USERPROFILE || '', '.kimi', 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory_data.json');

/**
 * 记忆条目接口
 */
/**
 * 文档元数据接口
 */
export interface DocumentMetadata {
  source: string;
  description: string;
  chunk_index: number;
  chunk_type: string;
  file_type: string;
  created_at: string;
  start_line?: number;
  end_line?: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
}

/**
 * 内存数据库
 */
let memoryCache: MemoryEntry[] | null = null;

/**
 * 确保目录存在
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch {
    // 目录已存在
  }
}

/**
 * 加载记忆数据
 */
async function loadMemory(): Promise<MemoryEntry[]> {
  if (memoryCache !== null) {
    return memoryCache;
  }

  await ensureDir();

  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    memoryCache = JSON.parse(data) as MemoryEntry[];
  } catch {
    // 文件不存在或解析失败，返回空数组
    memoryCache = [];
  }

  return memoryCache;
}

/**
 * 保存记忆数据
 */
async function saveMemory(entries: MemoryEntry[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(MEMORY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  memoryCache = entries;
}

// 初始化空缓存
memoryCache = [];

/**
 * 添加文档到记忆
 */
export async function addDocuments(
  contents: string[],
  embeddings: number[][],
  metadatas: DocumentMetadata[]
): Promise<void> {
  const memory = await loadMemory();

  const newEntries: MemoryEntry[] = contents.map((content, index) => ({
    id: `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    embedding: embeddings[index],
    metadata: metadatas[index],
  }));

  memory.push(...newEntries);
  await saveMemory(memory);
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  distance: number;
}

/**
 * 搜索相似文档
 */
export async function searchSimilar(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: Partial<DocumentMetadata>
): Promise<SearchResult[]> {
  const memory = await loadMemory();

  // 过滤符合条件的条目
  let candidates = memory;
  if (filter) {
    candidates = memory.filter(entry => {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && entry.metadata[key as keyof typeof entry.metadata] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  // 计算相似度并排序
  const scored = candidates.map(entry => ({
    entry,
    similarity: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  // 返回前N个结果
  return scored.slice(0, limit).map(({ entry, similarity }) => ({
    id: entry.id,
    content: entry.content,
    metadata: entry.metadata,
    distance: 1 - similarity, // 转换为距离（越小越相似）
  }));
}

/**
 * 列出所有已学习的文件（去重）
 */
export async function listSources(): Promise<Array<{ source: string; description: string; chunks: number; updated_at: string }>> {
  const memory = await loadMemory();

  // 按source分组统计
  const sourceMap = new Map<string, { description: string; chunks: number; updated_at: string }>();

  for (const entry of memory) {
    const { source, description, created_at } = entry.metadata;
    const existing = sourceMap.get(source);

    if (existing) {
      existing.chunks += 1;
      if (created_at > existing.updated_at) {
        existing.updated_at = created_at;
      }
    } else {
      sourceMap.set(source, {
        description,
        chunks: 1,
        updated_at: created_at,
      });
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
  const memory = await loadMemory();
  const initialCount = memory.length;

  const filtered = memory.filter(entry => entry.metadata.source !== source);
  const deletedCount = initialCount - filtered.length;

  if (deletedCount > 0) {
    await saveMemory(filtered);
  }

  return deletedCount;
}

/**
 * 获取统计信息
 */
export async function getStats(): Promise<{ total_documents: number; sources: number }> {
  const sources = await listSources();

  return {
    total_documents: sources.reduce((sum, s) => sum + s.chunks, 0),
    sources: sources.length,
  };
}
