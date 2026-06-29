/**
 * NikoAI — 本地节点桥接器（物理义体）
 * 向 Go 本地节点发送指令控制 OS。
 * 当前 Go 节点未运行，fetch 失败时返回友好提示。
 */

const LOCAL_NODE_URL = 'http://127.0.0.1:11451';

/**
 * 执行本地指令
 * @param {string} instruction - 本地执行命令
 * @param {string} [workspace] - 可选：特工自定义工作区路径
 * @returns {Promise<string>}
 */
export async function executeLocalCommand(instruction, workspace) {
  try {
    const body = { instruction };
    if (workspace) body.workspace = workspace;
    const res = await fetch(`${LOCAL_NODE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    return `[本地节点] ${text}`;
  } catch {
    return `[本地节点未连接] 无法执行指令: ${instruction}`;
  }
}

/**
 * 获取沙盒工作区挂载状态
 * @param {string} [workspace] - 可选：特工自定义工作区路径
 * @returns {Promise<{status:string, path:string, message:string}>}
 */
export async function getWorkspaceStatus(workspace) {
  try {
    const url = workspace
      ? `${LOCAL_NODE_URL}/workspace-status?workspace=${encodeURIComponent(workspace)}`
      : `${LOCAL_NODE_URL}/workspace-status`;
    const res = await fetch(url);
    return await res.json();
  } catch {
    return { status: 'disconnected', path: '', message: '本地节点未连接' };
  }
}

/**
 * 打开沙盒工作区（调用 OS 文件管理器）
 * @param {string} [workspace] - 可选：特工自定义工作区路径
 * @returns {Promise<string>}
 */
export async function openWorkspace(workspace) {
  try {
    const url = workspace
      ? `${LOCAL_NODE_URL}/open-workspace?workspace=${encodeURIComponent(workspace)}`
      : `${LOCAL_NODE_URL}/open-workspace`;
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    return data.output || '工作区已打开';
  } catch {
    return '[本地节点未连接] 无法打开工作区';
  }
}

/**
 * 🗡️ 通用 Go Bridge 武器调用
 * 向 Go Bridge 的武器端点发送 POST 请求
 * @param {string} endpoint - 武器端点路径（如 /api/tools/write_file）
 * @param {object} args - 参数对象
 * @param {string} [workspace] - 可选：特工自定义工作区路径
 * @returns {Promise<string>}
 */
export async function goBridgeTool(endpoint, args, workspace) {
  try {
    const body = { ...args };
    if (workspace) body.workspace = workspace;
    const res = await fetch(`${LOCAL_NODE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.status === 'error') {
      return `[武器故障] ${data.error}`;
    }
    return data.output || '[武器执行完毕]';
  } catch {
    return `[本地节点未连接] 无法调用武器: ${endpoint}`;
  }
}
