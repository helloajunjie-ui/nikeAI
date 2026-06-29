/**
 * NikoAI — 动态义体路由器 (Dynamic Tool Executor)
 * 从 ToolManager 动态查找工具定义，根据 execution.type 路由执行。
 * local_cmd → 模板插值 → executeLocalCommand
 * go_bridge → 直接调用 Go Bridge 武器端点
 * web_api   → 预留 fetch 路由
 */

import { ToolManager } from '../core/registry.js?v=20260629f';
import { executeLocalCommand, goBridgeTool } from './local_bridge.js?v=20260629f';
import { LiveStatus } from '../ui/chat_terminal.js?v=20260629f';

/**
 * 运行工具（动态查找）
 * @param {string} functionName - 工具 ID
 * @param {string} argsString - JSON 字符串参数
 * @param {string} [workspace] - 可选：特工自定义工作区路径
 * @returns {Promise<string>} 执行结果
 */
export async function runTool(functionName, argsString, workspace) {
  let args;
  try {
    args = JSON.parse(argsString);
  } catch {
    return `[错误] 参数解析失败: ${argsString}`;
  }

  // 从数据库动态查找工具定义
  const tools = await ToolManager.getAll();
  const tool = tools.find(t => (t.uid || t.id) === functionName);
  if (!tool) {
    return `[错误] 未知工具: ${functionName}，请先在「武器工坊」注册该武器`;
  }

  const { execution } = tool;
  if (!execution || !execution.type) {
    return `[错误] 工具 ${functionName} 缺少 execution 配置`;
  }

  LiveStatus.show(`⚡ 触发武器库！正在挂载 ${functionName} 执行...`);

  switch (execution.type) {
    case 'local_cmd': {
      // 模板插值：将 args 中的值替换到 template 占位符
      let cmd = execution.template || '';
      for (const [key, val] of Object.entries(args)) {
        cmd = cmd.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
      }
      const result = await executeLocalCommand(cmd, workspace);
      LiveStatus.clear();
      return result;
    }

    case 'go_bridge': {
      // 直接调用 Go Bridge 武器端点
      const endpoint = execution.endpoint || '';
      const result = await goBridgeTool(endpoint, args, workspace);
      LiveStatus.clear();
      return result;
    }

    case 'web_api': {
      // 预留：未来可基于 execution.template 发起 fetch
      const url = execution.template || '';
      LiveStatus.clear();
      return `[预留] web_api 尚未实现，目标 URL: ${url}`;
    }

    default:
      LiveStatus.clear();
      return `[错误] 不支持的执行类型: ${execution.type}`;
  }
}
