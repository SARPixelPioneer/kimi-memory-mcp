/**
 * 代码文件切片工具
 * 支持多种代码语言的智能切片
 */

export interface Chunk {
  content: string;
  metadata: {
    chunk_index: number;
    chunk_type: string;
    start_line?: number;
    end_line?: number;
  };
}

/**
 * 递归字符文本切片器
 * 通用fallback方案
 */
function recursiveCharacterSplit(text: string, chunkSize: number = 800, chunkOverlap: number = 100): string[] {
  const separators = ['\n\n', '\n', '. ', ' ', ''];
  const chunks: string[] = [];
  
  function splitRecursive(text: string, separatorIndex: number): string[] {
    if (separatorIndex >= separators.length) {
      return [text];
    }
    
    const separator = separators[separatorIndex];
    const parts = text.split(separator);
    
    const result: string[] = [];
    let currentChunk = '';
    
    for (const part of parts) {
      const partWithSep = separator === '' ? part : part + separator;
      
      if ((currentChunk + partWithSep).length <= chunkSize) {
        currentChunk += partWithSep;
      } else {
        if (currentChunk) {
          result.push(currentChunk.trim());
        }
        // 考虑重叠
        if (currentChunk.length > chunkOverlap) {
          currentChunk = currentChunk.slice(-chunkOverlap) + partWithSep;
        } else {
          currentChunk = partWithSep;
        }
      }
    }
    
    if (currentChunk) {
      result.push(currentChunk.trim());
    }
    
    return result;
  }
  
  return splitRecursive(text, 0).filter(c => c.length > 0);
}

/**
 * Python代码切片
 * 按函数、类、方法切片
 */
function splitPythonCode(content: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  
  const functionRegex = /^(def\s+\w+|class\s+\w+)/;
  let currentChunk: string[] = [];
  let chunkStartLine = 0;
  let inFunction = false;
  let baseIndent = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(functionRegex);
    
    if (match && !line.startsWith(' ') && !line.startsWith('\t')) {
      // 保存上一个chunk
      if (currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join('\n'),
          metadata: {
            chunk_index: chunks.length,
            chunk_type: inFunction ? 'function' : 'module',
            start_line: chunkStartLine + 1,
            end_line: i,
          },
        });
      }
      
      currentChunk = [line];
      chunkStartLine = i;
      inFunction = true;
      baseIndent = 0;
    } else if (inFunction) {
      // 检查是否退出函数
      if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
        // 保存当前函数chunk
        chunks.push({
          content: currentChunk.join('\n'),
          metadata: {
            chunk_index: chunks.length,
            chunk_type: 'function',
            start_line: chunkStartLine + 1,
            end_line: i,
          },
        });
        
        currentChunk = [line];
        chunkStartLine = i;
        inFunction = false;
      } else {
        currentChunk.push(line);
      }
    } else {
      currentChunk.push(line);
    }
  }
  
  // 保存最后一个chunk
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      metadata: {
        chunk_index: chunks.length,
        chunk_type: inFunction ? 'function' : 'module',
        start_line: chunkStartLine + 1,
        end_line: lines.length,
      },
    });
  }
  
  return chunks;
}

/**
 * JavaScript/TypeScript代码切片
 */
function splitJavaScriptCode(content: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  
  // 匹配函数、类、导出
  const functionRegex = /^(export\s+)?(async\s+)?(function|class|const|let|var)\s+\w+/;
  const arrowFunctionRegex = /^(export\s+)?(const|let|var)\s+\w+\s*=/;
  
  let currentChunk: string[] = [];
  let chunkStartLine = 0;
  let braceCount = 0;
  let inBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查是否是新的函数/类定义
    const isNewBlock = functionRegex.test(line) || arrowFunctionRegex.test(line);
    
    if (isNewBlock && !inBlock) {
      // 保存上一个chunk
      if (currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join('\n'),
          metadata: {
            chunk_index: chunks.length,
            chunk_type: 'module',
            start_line: chunkStartLine + 1,
            end_line: i,
          },
        });
      }
      
      currentChunk = [line];
      chunkStartLine = i;
      inBlock = true;
      braceCount = 0;
    } else {
      currentChunk.push(line);
      
      // 简单的大括号计数
      if (inBlock) {
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        // 如果大括号平衡且当前行以}结尾，可能是块结束
        if (braceCount === 0 && line.trim().endsWith('}')) {
          chunks.push({
            content: currentChunk.join('\n'),
            metadata: {
              chunk_index: chunks.length,
              chunk_type: 'function',
              start_line: chunkStartLine + 1,
              end_line: i + 1,
            },
          });
          currentChunk = [];
          inBlock = false;
        }
      }
    }
  }
  
  // 保存剩余的代码
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      metadata: {
        chunk_index: chunks.length,
        chunk_type: inBlock ? 'function' : 'module',
        start_line: chunkStartLine + 1,
        end_line: lines.length,
      },
    });
  }
  
  return chunks;
}

/**
 * 通用文本切片
 */
function splitGenericText(content: string): Chunk[] {
  const textChunks = recursiveCharacterSplit(content, 800, 100);
  
  return textChunks.map((text, index) => ({
    content: text,
    metadata: {
      chunk_index: index,
      chunk_type: 'text',
    },
  }));
}

/**
 * 根据文件类型选择切片策略
 */
export function splitDocument(content: string, filePath: string): Chunk[] {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'py':
      return splitPythonCode(content);
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return splitJavaScriptCode(content);
    case 'md':
    case 'txt':
    case 'json':
    case 'yaml':
    case 'yml':
      return splitGenericText(content);
    default:
      // 尝试代码切片，失败则使用通用切片
      try {
        return splitGenericText(content);
      } catch {
        return [{
          content: content.slice(0, 4000), // 限制长度
          metadata: {
            chunk_index: 0,
            chunk_type: 'raw',
          },
        }];
      }
  }
}
