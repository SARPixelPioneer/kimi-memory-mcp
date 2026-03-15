/**
 * DeepSeek API 封装
 * 用于内容预处理和结构化
 */

const DEEPSEEK_API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || '';
const DEEPSEEK_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const DEEPSEEK_MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-chat';

export interface StructureResult {
  summary: string;
  keyPoints: string[];
  actionItems?: string[];
  context?: string;
}

/**
 * 检查是否需要预处理
 */
export function needsPreprocessing(content: string, fileExt: string): boolean {
  // 代码文件：不需要
  const codeExtensions = ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs', '.cpp', '.c', '.h'];
  if (codeExtensions.includes(fileExt.toLowerCase())) {
    return false;
  }
  
  // 文本内容过长（超过1500字符）：需要
  if (content.length > 1500) {
    return true;
  }
  
  // 包含特定关键词：需要
  const complexKeywords = ['会议', '讨论', '结论', '待办', '问题', '方案', '决策', '计划', '总结', '分析'];
  if (complexKeywords.some(kw => content.includes(kw))) {
    return true;
  }
  
  // Markdown文档通常需要结构化
  if (fileExt.toLowerCase() === '.md') {
    return true;
  }
  
  return false;
}

/**
 * 使用 DeepSeek 整理内容
 */
export async function structureContent(content: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured. Set ANTHROPIC_AUTH_TOKEN environment variable.');
  }

  const prompt = `请对以下内容进行结构化整理，提取关键信息。

要求：
1. 用简洁的语言总结核心主题（2-3句话）
2. 列出3-5个关键要点
3. 如果有待办事项或行动点，请单独列出
4. 保留重要的上下文信息

原始内容：
${content.slice(0, 6000)}

请用中文输出以下格式：

【核心主题】
（简洁总结）

【关键要点】
1. ...
2. ...
3. ...

【待办事项】（如有）
- ...

【上下文】
（相关背景信息）`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };
    
    return data.content[0]?.text || content;
  } catch (error) {
    console.error('DeepSeek API error:', error);
    // 如果API调用失败，返回原始内容
    return content;
  }
}

/**
 * 生成代码摘要（用于代码文件）
 */
export async function summarizeCode(content: string, language: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    return content;
  }

  const prompt = `请对以下${language}代码进行简要说明：

\`\`\`${language}
${content.slice(0, 4000)}
\`\`\`

要求：
1. 说明这段代码的主要功能（1-2句话）
2. 列出关键函数/类及其作用
3. 给出使用示例（如有）

请用中文输出。`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        max_tokens: 1500,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      return content;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };
    
    return data.content[0]?.text || content;
  } catch {
    return content;
  }
}

/**
 * 批量处理内容（带并发控制）
 */
export async function batchStructureContents(
  contents: Array<{ content: string; fileExt: string }>,
  maxConcurrency: number = 3
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < contents.length; i += maxConcurrency) {
    const batch = contents.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(async ({ content, fileExt }) => {
        if (needsPreprocessing(content, fileExt)) {
          return await structureContent(content);
        }
        return content;
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}
