/**
 * ChromaDB 存储 - 使用 HTTP 客户端连接 Docker 服务
 */

export {
  addDocuments,
  searchSimilar,
  listSources,
  deleteBySource,
  getStats,
  checkChromaHealth,
  type SearchResult,
  type DocumentMetadata,
} from './chroma_http.js';
