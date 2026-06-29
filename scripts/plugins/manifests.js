/**
 * NikoAI — 插件协议库 (The Plugin Pool)
 * 所有可用工具的 Manifest Schema 定义。
 * 纯协议层，不包含具体执行逻辑。
 */

const ToolManifests = [
  {
    id: 'web_search',
    name: '全网搜索',
    description: '搜索实时网络信息',
    type: 'web',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词'
        }
      },
      required: ['query']
    }
  },
  {
    id: 'local_commander',
    name: '本机指令桥接',
    description: '向本地 Go 节点发送指令控制 OS',
    type: 'local',
    parameters: {
      type: 'object',
      properties: {
        instruction: {
          type: 'string',
          description: '本地执行的命令'
        }
      },
      required: ['instruction']
    }
  },
  // ─── 🗡️ 三把工业级武器 ─────────────────────────
  {
    id: 'file_writer',
    name: '文件手术刀',
    description: '精准写入文件到沙盒工作区，无转义地狱，自动创建目录',
    type: 'go_bridge',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: '文件路径（相对 .workspace 沙盒）'
        },
        content: {
          type: 'string',
          description: '文件内容'
        }
      },
      required: ['filename', 'content']
    }
  },
  {
    id: 'web_reader',
    name: '深网穿透器',
    description: '读取任意 URL 的完整页面内容，自动提取纯文本（HTML→Text）',
    type: 'go_bridge',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '目标网页 URL'
        }
      },
      required: ['url']
    }
  },
  {
    id: 'system_notify',
    name: '赛博传呼机',
    description: '发送系统桌面原生通知（Windows Toast / Mac 通知中心 / Linux notify-send）',
    type: 'go_bridge',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '通知标题'
        },
        message: {
          type: 'string',
          description: '通知正文'
        }
      },
      required: ['title', 'message']
    }
  }
];

/**
 * 获取所有工具 Manifest
 * @returns {Array}
 */
export function getTools() {
  return ToolManifests;
}

/**
 * 将选中的工具 ID 转换为 OpenAI Function Calling 格式
 * @param {string[]} selectedToolIds
 * @returns {Array} OpenAI tools 格式数组
 */
export function getOpenAITools(selectedToolIds) {
  return ToolManifests
    .filter(t => selectedToolIds.includes(t.id))
    .map(t => ({
      type: 'function',
      function: {
        name: t.id,
        description: t.description,
        parameters: t.parameters
      }
    }));
}
