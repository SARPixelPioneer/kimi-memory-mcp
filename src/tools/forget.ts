/**
 * forget_file 工具
 * 删除文件记忆
 */

import { deleteBySource } from '../store/chroma.js';

export interface ForgetFileArgs {
  file_path: string;
}

export interface ForgetFileResult {
  success: boolean;
  message?: string;
  deleted_chunks?: number;
  error?: string;
}

/**
 * 执行删除记忆
 */
export async function forgetFile(args: ForgetFileArgs): Promise<ForgetFileResult> {
  try {
    // 删除指定文件的所有记忆
    const deletedCount = await deleteBySource(args.file_path);

    if (deletedCount === 0) {
      return {
        success: false,
        error: `未找到该文件的记忆: ${args.file_path}`,
      };
    }

    return {
      success: true,
      message: `已成功删除文件记忆`,
      deleted_chunks: deletedCount,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `删除记忆时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 工具Schema定义
 */
export const forgetFileSchema = {
  name: 'forget_file',
  description: '删除指定文件的所有记忆。当用户说"忘记这个文件"、"删除记忆"、"清除这个文件"、"移除知识库中的文件"、"删掉这个记录"时，使用此工具清除相关记忆。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: '要删除记忆的文件的完整路径。',
      },
    },
    required: ['file_path'],
  },
};
