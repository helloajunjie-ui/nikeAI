/**
 * NikoAI — 核心执行引擎 (The Core Engine)
 * 监听 UI 层请求，调度 Agent / Workflow 逻辑。
 * 绝不操作 DOM，纯事件驱动。
 *
 * 双轨道架构：
 *   Track A — 工作流流水线 (workflow_request_submitted)
 *   Track B — 特工 ReAct 循环 (chat_request_submitted)
 */

import { EventBus } from './eventBus.js?v=20260629f';
import { AgentManager, ProviderManager, WorkflowManager, ToolManager } from './registry.js?v=20260629f';
import { callLLM } from './llm_api.js?v=20260629f';
import { runTool } from '../plugins/executor.js?v=20260629f';
import { LiveStatus } from '../ui/chat_terminal.js?v=20260629f';

// 沙盒工作区路径（相对于项目根目录）
const WORKSPACE_PATH = (() => {
  // 从当前脚本路径推断：scripts/core/engine.js → 项目根 → .workspace
  const scripts = document.currentScript?.src || '';
  if (scripts) {
    const base = scripts.substring(0, scripts.indexOf('/scripts/'));
    return base + '/.workspace';
  }
  return '/.workspace'; // fallback
})();

const MAX_ITER = 20;

function log(text) {
  EventBus.emit('chat_render_log', { text });
}

// ─── 插值引擎 ─────────────────────────────────────
// 替换模板中的 {{userInput}} 和 {{artifacts.step_N}}
function interpolate(template, context) {
  let result = template;
  // 替换用户输入
  result = result.replace(/\{\{userInput\}\}/g, context.userInput || '');
  // 替换制品引用
  if (context.artifacts) {
    result = result.replace(/\{\{artifacts\.(\w+)\}\}/g, (_, key) => {
      return context.artifacts[key] !== undefined ? context.artifacts[key] : `{{artifacts.${key}}}`;
    });
  }
  return result;
}

// ─── Track B: 特工 ReAct 循环 ─────────────────────

async function handleChatRequest({ agentId, text }) {
  // ─── 1. 取出特工 ──────────────────────────
  const agent = await AgentManager.get(agentId);
  if (!agent) {
    log(`[System] 错误：未找到特工 (${agentId})`);
    return;
  }

  log(`[System] 引擎已唤醒特工：${agent.name}`);

  // ─── 2. 检测武器库 ─────────────────────────
  const tools = agent.tools || [];
  if (tools.length > 0) {
    log(`[System] 检测到武器库挂载：[ ${tools.join(', ')} ]。准备进入 Function Calling 神经链路...`);
  }

  // ─── 3. 获取算力通道 ───────────────────────
  const provider = await ProviderManager.get(agent.providerId);
  if (!provider) {
    log(`[System] 错误：特工 "${agent.name}" 未绑定有效算力通道 (providerId: ${agent.providerId})`);
    return;
  }

  // ─── 4. 解析特工工作区 ─────────────────────
  const workspace = agent.workspace || '.workspace';

  // ─── 5. 组装对话上下文 ─────────────────────
  // 自动注入沙盒挂载声明（物理法则，非道德约束）
  const sandboxDiscipline = `

【系统挂载点说明】
你已被物理挂载至独立的沙盒工作区「${workspace}」。
当你使用 local_commander 时，你的默认根目录 (./) 就是该工作区。
直接使用 echo "代码" > test.js 或 dir，无需关心宿主机的绝对路径。
严禁尝试逃逸沙盒（如 cd .. 等操作已被底层拦截）。`;

  const messages = [
    { role: 'system', content: (agent.prompt || '') + sandboxDiscipline },
    { role: 'user', content: text }
  ];

  // 从数据库动态拉取武器定义，组装 OpenAI Function Calling payload
  const allTools = await ToolManager.getAll();
  const activeTools = allTools.filter(t => tools.includes(t.id));
  const toolPayload = activeTools.map(t => ({
    type: 'function',
    function: {
      name: t.id,
      description: t.description,
      parameters: t.parameters
    }
  }));

  // ─── 5. ReAct 循环 ─────────────────────────
  let iterations = 0;

  while (iterations < MAX_ITER) {
    iterations++;
    log(`[System] 🧠 思考回合 ${iterations}/${MAX_ITER}...`);
    LiveStatus.show(`🧠 V8 引擎思考中... 第 ${iterations}/${MAX_ITER} 回合`);

    // 发起 LLM 请求
    let message;
    try {
      message = await callLLM({
        provider,
        model: agent.model,
        messages,
        tools: toolPayload
      });
    } catch (err) {
      LiveStatus.clear();
      log(`[System] ❌ LLM 调用失败：${err.message}`);
      return;
    }

    // 将 AI 回复追加到上下文（保持对话合法性）
    messages.push(message);

    // ─── 分支 A: Tool Call ─────────────────
    if (message.tool_calls && message.tool_calls.length > 0) {
      const names = message.tool_calls.map(t => t.function.name).join(', ');
      log(`[System] ⚡ 触发自主决策！AI 决定调用工具：${names}`);
      LiveStatus.show(`⚡ 触发武器库！AI 决定调用：${names}`);

      // 遍历执行每个工具
      for (const tool of message.tool_calls) {
        LiveStatus.show(`🔧 正在执行 ${tool.function.name}...`);
        const result = await runTool(tool.function.name, tool.function.arguments, workspace);
        log(`[System] 🔧 工具执行完毕: ${tool.function.name} -> 返回了 ${result.length} 字符`);

        // 将工具结果追加到上下文（OpenAI 规范：role='tool' 必须有 tool_call_id）
        messages.push({
          role: 'tool',
          tool_call_id: tool.id,
          name: tool.function.name,
          content: result
        });
      }

      // 不 break，让大模型带着工具结果继续思考
      continue;
    }

    // ─── 分支 B: 普通回答 ─────────────────
    LiveStatus.clear();
    if (message.content) {
      log(`> AI: ${message.content}`);
      break;
    }

    // 兜底：既无 tool_calls 也无 content
    log('[System] ⚠️ AI 返回了空响应，终止循环');
    break;
  }

  // ─── 超时兜底 ─────────────────────────────
  if (iterations >= MAX_ITER) {
    log('[System] ⛔ 引擎思考超时，强制终止');
  }
}

// ─── Track A: 工作流流水线执行 ────────────────────

async function handleWorkflowRequest({ workflowId, userInput }) {
  const workflow = await WorkflowManager.get(workflowId);
  if (!workflow) {
    log(`[System] 错误：未找到工作流 (${workflowId})`);
    return;
  }

  log(`[System] ⎔ 启动流水线：${workflow.name}（${workflow.steps.length} 步）`);
  LiveStatus.show(`⎔ 启动流水线：${workflow.name}`);

  const artifacts = {}; // 步骤输出缓存

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    log(`[System] ⎔ 步骤 ${i + 1}/${workflow.steps.length}: ${step.type}${step.toolId ? ' (' + step.toolId + ')' : ''}`);
    LiveStatus.show(`⎔ 步骤 ${i + 1}/${workflow.steps.length}: ${step.type}${step.toolId ? ' (' + step.toolId + ')' : ''}`);

    if (step.type === 'llm') {
      // ─── LLM 步骤 ────────────────────────
      const provider = await ProviderManager.get(step.providerId);
      if (!provider) {
        LiveStatus.clear();
        log(`[System] ❌ 步骤 ${i + 1} 失败：未找到算力通道 (${step.providerId})`);
        return;
      }

      if (!step.model) {
        LiveStatus.clear();
        log(`[System] ❌ 步骤 ${i + 1} 失败：未指定模型`);
        return;
      }

      const prompt = interpolate(step.prompt, { userInput, artifacts });
      const messages = [
        { role: 'system', content: step.systemPrompt || '' },
        { role: 'user', content: prompt }
      ];

      LiveStatus.show(`🧠 步骤 ${i + 1} LLM 推理中...`);

      try {
        const message = await callLLM({
          provider,
          model: step.model,
          messages
        });
        const content = message.content || '';
        artifacts[`step_${i}`] = content;
        log(`[System] ✅ 步骤 ${i + 1} LLM 输出: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`);
      } catch (err) {
        LiveStatus.clear();
        log(`[System] ❌ 步骤 ${i + 1} LLM 调用失败：${err.message}`);
        return;
      }
    } else if (step.type === 'tool') {
      // ─── 工具步骤 ────────────────────────
      const rawParams = step.params || {};
      // 对 params 中所有字符串值做插值替换
      const resolvedParams = {};
      for (const [key, val] of Object.entries(rawParams)) {
        resolvedParams[key] = typeof val === 'string'
          ? interpolate(val, { userInput, artifacts })
          : val;
      }

      LiveStatus.show(`🔧 步骤 ${i + 1} 执行工具: ${step.toolId}`);

      try {
        const result = await runTool(step.toolId, JSON.stringify(resolvedParams));
        artifacts[`step_${i}`] = result;
        log(`[System] ✅ 步骤 ${i + 1} 工具执行完毕: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);
      } catch (err) {
        LiveStatus.clear();
        log(`[System] ❌ 步骤 ${i + 1} 工具执行失败：${err.message}`);
        return;
      }
    } else {
      log(`[System] ⚠️ 步骤 ${i + 1} 跳过：未知类型 "${step.type}"`);
    }
  }

  LiveStatus.clear();
  log(`[System] 🎉 流水线 "${workflow.name}" 执行完毕`);
}

// ─── 引擎入口 ─────────────────────────────────────

export function initEngine() {
  EventBus.on('chat_request_submitted', handleChatRequest);
  EventBus.on('workflow_request_submitted', handleWorkflowRequest);
}
