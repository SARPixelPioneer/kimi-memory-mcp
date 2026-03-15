/**
 * Ollama API 封装
 * 用于生成文本Embedding
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'bge-m3:latest';

export interface EmbeddingResponse {
  embedding: number[];
}

/**
 * 生成文本的Embedding向量
 * @param text 输入文本
 * @returns 向量数组
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const url = `${OLLAMA_HOST}/api/embeddings`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as EmbeddingResponse;
  return data.embedding;
}

/**
 * 批量生成Embedding
 * @param texts 文本数组
 * @returns 向量数组的数组
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

/**
 * 检查Ollama服务是否可用
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 获取可用的Embedding模型列表
 */
export async function listEmbeddingModels(): Promise<string[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/tags`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch models from Ollama');
  }
  
  const data = await response.json() as { models: Array<{ name: string; details?: { family?: string } }> };
  
  // 过滤出适合Embedding的模型 (bert家族)
  return data.models
    .filter(m => m.details?.family === 'bert' || m.name.includes('bge') || m.name.includes('embed'))
    .map(m => m.name);
}
