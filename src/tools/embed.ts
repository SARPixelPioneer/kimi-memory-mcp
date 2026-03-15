/**
 * embed_file 工具
 * 学习文件并存入记忆 - 支持DeepSeek预处理（方案3：混合存储）
 */

import { generateEmbedding, generateEmbeddings, checkOllamaHealth } from '../utils/ollama.js';
import { splitDocument } from '../utils/splitter.js';
import { addDocuments, DocumentMetadata } from '../store/chroma.js';
import { needsPreprocessing, structureContent, summarizeCode } from '../utils/deepseek.js';
import fs from 'fs/promises';
import path from 'path';

export interface EmbedFileArgs {
  file_path: string;
  description: string;
  preprocess?: boolean;  // 是否启用LLM预处理
}

export interface EmbedFileResult {
  success: boolean;
  message?: string;
  chunks_count?: number;
  preprocessed_count?: number;
  error?: string;
}

/**
 * 执行文件Embedding - 混合存储方案
 * 同时存储原始内容和DeepSeek整理后的内容
 */
export async function embedFile(args: EmbedFileArgs): Promise<EmbedFileResult> {
  try {
    // 1. 检查Ollama服务
    const isHealthy = await checkOllamaHealth();
    if (!isHealthy) {
      return {
        success: false,
        error: 'Ollama服务未运行，请先启动Ollama',
      };
    }

    // 2. 检查文件是否存在
    try {
      await fs.access(args.file_path);
    } catch {
      return {
        success: false,
        error: `文件不存在: ${args.file_path}`,
      };
    }

    // 3. 读取文件内容
    const content = await fs.readFile(args.file_path, 'utf-8');
    if (!content.trim()) {
      return {
        success: false,
        error: '文件内容为空',
      };
    }

    // 4. 切片处理
    const chunks = splitDocument(content, args.file_path);
    if (chunks.length === 0) {
      return {
        success: false,
        error: '无法从文件中提取有效内容',
      };
    }

    const fileExt = path.extname(args.file_path).slice(1) || 'unknown';
    const now = new Date().toISOString();
    
    // 5. 准备存储的内容数组
    const allContents: string[] = [];
    const allMetadatas: DocumentMetadata[] = [];
    let preprocessedCount = 0;

    // 6. 处理每个切片（混合存储）
    for (const chunk of chunks) {
      const baseMetadata = {
        source: args.file_path,
        description: args.description,
        chunk_index: chunk.metadata.chunk_index,
        chunk_type: chunk.metadata.chunk_type,
        file_type: fileExt,
        created_at: now,
        start_line: chunk.metadata.start_line,
        end_line: chunk.metadata.end_line,
      };

      // 6.1 存储原始内容
      allContents.push(chunk.content);
      allMetadatas.push({
        ...baseMetadata,
        chunk_index: chunk.metadata.chunk_index * 2, // 偶数索引给原始内容
      });

      // 6.2 判断是否需要进行LLM预处理
      const shouldPreprocess = args.preprocess !== false && // 默认启用
        needsPreprocessing(chunk.content, fileExt);

      if (shouldPreprocess) {
        try {
          let structuredContent: string;
          
          // 根据文件类型选择预处理方式
          if (['py', 'js', 'ts', 'java', 'go'].includes(fileExt)) {
            structuredContent = await summarizeCode(chunk.content, fileExt);
          } else {
            structuredContent = await structureContent(chunk.content);
          }
          
          // 存储结构化内容（如果与原始内容不同）
          if (structuredContent !== chunk.content) {
            allContents.push(structuredContent);
            allMetadatas.push({
              ...baseMetadata,
              chunk_index: chunk.metadata.chunk_index * 2 + 1, // 奇数索引给结构化内容
              chunk_type: `${chunk.metadata.chunk_type}_structured`,
            });
            preprocessedCount++;
          }
        } catch (error) {
          // LLM处理失败，只存储原始内容
          console.error(`预处理失败，跳过: ${error}`);
        }
      }
    }

    // 7. 生成所有内容的Embeddings
    const embeddings = await generateEmbeddings(allContents);

    // 8. 存入ChromaDB
    await addDocuments(allContents, embeddings, allMetadatas);

    return {
      success: true,
      message: `成功学习文件: ${path.basename(args.file_path)}`,
      chunks_count: chunks.length,
      preprocessed_count: preprocessedCount,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `向量化过程中发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 工具Schema定义
 */
export const embedFileSchema = {
  name: 'embed_file',
  description: '当用户需要保存文件内容、学习新知识、记住某个文件、将文件加入知识库、存储代码或文档时，调用此工具。触发场景包括：用户说"学习这个文件"、"记住这个文件"、"保存到记忆"、"加入知识库"、"存储这个文档"、"把这个代码记下来"等。支持DeepSeek自动预处理复杂内容。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: '需要学习并向量化的本地文件绝对或相对路径。',
      },
      description: {
        type: 'string',
        description: '简要描述这个文件属于什么业务模块（例如：WebGIS 图层控制、数据要素分析等），将作为元数据保存。',
      },
      preprocess: {
        type: 'boolean',
        description: '是否启用DeepSeek LLM预处理（默认true）。对于复杂文档会进行结构化整理，代码文件会生成摘要。',
        default: true,
      },
    },
    required: ['file_path', 'description'],
  },
};
