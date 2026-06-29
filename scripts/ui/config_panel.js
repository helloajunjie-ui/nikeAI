/**
 * NikoAI — 配置面板渲染器
 * 表单提交、数据落盘、列表渲染。
 * 严格贯彻 Pub/Sub：提交只负责 Save + Emit，列表只负责 Listen + Render。
 */

import { EventBus } from '../core/eventBus.js?v=20260629f';
import { ProviderManager, AgentManager, WorkflowManager, ToolManager } from '../core/registry.js?v=20260629f';
import { fetchProviderModels } from '../core/llm_api.js?v=20260629f';
import { getWorkspaceStatus, openWorkspace } from '../plugins/local_bridge.js?v=20260629f';

// ─── 工具武器复选框渲染（动态：从 ToolManager 读取） ─────

async function renderToolCheckboxes() {
  const container = document.getElementById('agent-tools-checkboxes');
  if (!container) return;
  const tools = await ToolManager.getAll();
  container.innerHTML = tools.map(t =>
    `<label><input type="checkbox" name="tools" value="${t.uid || t.id}"> ${t.name}</label>`
  ).join('');
}

// ─── Provider 列表渲染 ────────────────────────────────

async function renderProviderList() {
  const list = document.getElementById('list-providers');
  if (!list) return;

  const providers = await ProviderManager.getAll();
  list.innerHTML = '';

  if (providers.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-secondary);';
    empty.textContent = '暂无已注册算力';
    list.appendChild(empty);
    return;
  }

  providers.forEach(p => {
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg-dark,#1e1e2e);border:1px solid var(--border-color,#333);border-radius:8px;padding:16px;margin-bottom:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333;padding-bottom:10px;margin-bottom:10px;">
        <h4 style="margin:0;color:#fff;font-size:1.1rem;font-weight:600;">${p.name}</h4>
      </div>
      <div style="font-size:0.85rem;color:#aaa;line-height:1.6;">
        <p style="margin:0 0 4px 0;"><strong>地址:</strong> <span style="color:#ccc;">${p.url}</span></p>
        <p style="margin:0;"><strong>模型数:</strong> <span style="color:#4da6ff;">${(p.models || []).length} 个</span></p>
      </div>
    `;
    list.appendChild(div);
  });
}

// ─── Agent 列表渲染 ────────────────────────────────

async function renderAgentList() {
    const list = document.getElementById('list-agents');
    if (!list) return;
  
    const agents = await AgentManager.getAll();
    if (agents.length === 0) {
        list.innerHTML = '暂无已注册特工';
        return;
    }
  
    list.innerHTML = '';
  
    agents.forEach(agent => {
        const div = document.createElement('div');
        div.style.cssText = 'position: relative; background: var(--bg-dark, #1e1e2e); border: 1px solid var(--border-color, #333); border-radius: 8px; padding: 15px; margin-bottom: 12px; box-sizing: border-box;';
      
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                <h4 style="margin: 0; color: #fff; font-size: 1.1rem; line-height: 1.2;">${agent.name}</h4>
            </div>
            <div style="font-size: 0.85rem; color: #aaa; line-height: 1.5;">
                <p style="margin: 0 0 4px 0;">模型: <span style="color: #ccc;">${agent.model}</span></p>
                <p style="margin: 0;">武器: <span style="color: #4da6ff;">${(agent.tools || []).join(', ') || '裸装'}</span></p>
            </div>
        `;
        list.appendChild(div);
    });
}

// ─── 级联选择器渲染 ────────────────────────────────

async function renderProviderSelect() {
  const sel = document.getElementById('agent-provider-select');
  if (!sel) return;
  const providers = await ProviderManager.getAll();
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- 选择算力服务商 --</option>' +
    providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  sel.value = currentVal;
  // 触发模型选择器刷新
  renderModelSelect();
}

async function renderModelSelect() {
  const providerSel = document.getElementById('agent-provider-select');
  const modelSel = document.getElementById('agent-model-select');
  if (!providerSel || !modelSel) return;
  const providerId = providerSel.value;
  const currentModel = modelSel.value;
  modelSel.innerHTML = '<option value="">-- 选择模型 --</option>';
  if (!providerId) return;
  const providers = await ProviderManager.getAll();
  const provider = providers.find(p => p.id === providerId);
  if (provider && provider.models) {
    provider.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      modelSel.appendChild(opt);
    });
  }
  modelSel.value = currentModel;
}

// ─── 工具表单提交（神圣锻造）────────────────────────

function setupToolForm() {
  const form = document.getElementById('form-tool');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const configRaw = fd.get('configJson').trim();
    let config;
    try {
      config = JSON.parse(configRaw);
    } catch (err) {
      alert(`JSON 解析失败：${err.message}`);
      return;
    }
    if (!config.parameters || !config.execution) {
      alert('JSON 必须包含 parameters 和 execution 字段');
      return;
    }
    const uid = fd.get('uid').trim();
    const tool = {
      id: uid,  // 向后兼容：executor.js 和旧数据依赖 id
      uid: uid,
      name: fd.get('name').trim(),
      author: fd.get('author').trim(),
      version: fd.get('version').trim(),
      description: fd.get('description').trim(),
      parameters: config.parameters,
      execution: config.execution,
      createdAt: new Date().toISOString()
    };
    await ToolManager.save(tool);
    EventBus.emit('tool_updated');
    form.reset();
  });
}

// ─── 工具列表渲染（极客武器卡片）────────────────────

async function renderToolList() {
  const list = document.getElementById('list-tools');
  if (!list) return;

  const tools = await ToolManager.getAll();
  list.innerHTML = '';

  if (tools.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-secondary);text-align:center;padding:40px 0;';
    empty.textContent = '🔧 武器库为空，去上方锻造你的第一把武器吧';
    list.appendChild(empty);
    return;
  }

  tools.forEach(tool => {
    const div = document.createElement('div');
    div.style.cssText = 'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border:1px solid #2a2a4a;border-radius:12px;padding:18px;margin-bottom:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:border-color 0.2s;';
    div.onmouseenter = () => { div.style.borderColor = '#4da6ff'; };
    div.onmouseleave = () => { div.style.borderColor = '#2a2a4a'; };

    const author = tool.author || '匿名';
    const version = tool.version || '0.0.0';
    const uid = tool.uid || tool.id || 'unknown';
    const execType = tool.execution ? tool.execution.type : '未知';
    const paramCount = tool.parameters && tool.parameters.properties ? Object.keys(tool.parameters.properties).length : 0;

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #2a2a4a;padding-bottom:12px;margin-bottom:12px;">
        <div>
          <h4 style="margin:0;color:#fff;font-size:1.1rem;font-weight:600;">${tool.name}</h4>
          <p style="margin:4px 0 0 0;font-size:0.75rem;color:#666;font-family:var(--font-mono,monospace);">${uid}</p>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;background:#2d2d5e;color:#7c7cff;padding:2px 10px;border-radius:4px;font-size:0.75rem;font-family:var(--font-mono,monospace);">v${version}</span>
        </div>
      </div>
      <div style="font-size:0.82rem;color:#aaa;line-height:1.7;">
        <p style="margin:0 0 8px 0;color:#ccc;">${tool.description || '无描述'}</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span><strong style="color:#888;">作者:</strong> <span style="color:#4da6ff;">${author}</span></span>
          <span><strong style="color:#888;">执行:</strong> <span style="color:#7c7cff;">${execType}</span></span>
          <span><strong style="color:#888;">参数:</strong> <span style="color:#aaa;">${paramCount} 个</span></span>
        </div>
      </div>
    `;
    list.appendChild(div);
  });
}

// ─── Provider 表单提交（含探活） ──────────────────────

function setupProviderForm() {
  const form = document.getElementById('form-provider');
  const btn = document.getElementById('btn-save-provider');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const url = fd.get('url').replace(/\/+$/, '');
    const apiKey = fd.get('apiKey');

    // 探活中...
    btn.textContent = '探活中...';
    btn.disabled = true;

    try {
      const models = await fetchProviderModels(url, apiKey);
      const provider = {
        id: crypto.randomUUID(),
        name: fd.get('name'),
        url,
        apiKey,
        models,
        createdAt: new Date().toISOString()
      };
      await ProviderManager.save(provider);
      EventBus.emit('provider_updated');
      form.reset();
      btn.textContent = '验证并保存算力';
    } catch (err) {
      alert(`探活失败：${err.message}\n请检查 API 地址和密钥是否正确。`);
    } finally {
      btn.textContent = '验证并保存算力';
      btn.disabled = false;
    }
  });
}

// ─── 沙盒工作区挂载状态渲染 ──────────────────────

async function renderWorkspaceStatus(workspace) {
  const indicator = document.getElementById('ws-indicator');
  const pathEl = document.getElementById('ws-path');
  if (!indicator || !pathEl) return;

  // 从输入框获取工作区路径（如果未传入）
  if (!workspace) {
    const input = document.getElementById('agent-workspace-input');
    workspace = input ? input.value.trim() || '.workspace' : '.workspace';
  }

  const ws = await getWorkspaceStatus(workspace);
  if (ws.status === 'active') {
    indicator.style.background = '#4ade80';
    indicator.style.boxShadow = '0 0 6px #4ade80';
    pathEl.textContent = ws.path;
    pathEl.style.color = '#4ade80';
  } else {
    indicator.style.background = '#ef4444';
    indicator.style.boxShadow = '0 0 6px #ef4444';
    pathEl.textContent = '⚠️ 沙盒未挂载 — 请确认 Go Bridge 已启动';
    pathEl.style.color = '#ef4444';
  }
}

// ─── Agent 表单提交 ────────────────────────────────

function setupAgentForm() {
  const form = document.getElementById('form-agent');
  if (!form) return;

  // 工作区路径输入变化时实时刷新状态
  const wsInput = document.getElementById('agent-workspace-input');
  if (wsInput) {
    wsInput.addEventListener('input', () => {
      renderWorkspaceStatus(wsInput.value.trim() || '.workspace');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const checkedTools = Array.from(
      document.querySelectorAll('input[name="tools"]:checked')
    ).map(cb => cb.value);
    const agent = {
      id: crypto.randomUUID(),
      name: fd.get('name'),
      providerId: fd.get('providerId'),
      model: fd.get('model'),
      prompt: fd.get('prompt'),
      workspace: fd.get('workspace') || '.workspace',
      tools: checkedTools,
      createdAt: new Date().toISOString()
    };
    await AgentManager.save(agent);
    EventBus.emit('agent_updated');
    form.reset();
    // 重置后恢复默认 workspace
    if (wsInput) wsInput.value = '.workspace';
    renderWorkspaceStatus('.workspace');
  });
}

// ─── 工作流表单提交 ─────────────────────────────

function setupWorkflowForm() {
  const form = document.getElementById('form-workflow');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const stepsRaw = fd.get('steps').trim();
    let steps;
    try {
      steps = JSON.parse(stepsRaw);
      if (!Array.isArray(steps)) throw new Error('steps 必须是数组');
    } catch (err) {
      alert(`JSON 解析失败：${err.message}\n请检查步骤格式是否正确。`);
      return;
    }
    const workflow = {
      id: crypto.randomUUID(),
      name: fd.get('name'),
      steps,
      createdAt: new Date().toISOString()
    };
    await WorkflowManager.save(workflow);
    EventBus.emit('workflow_updated');
    form.reset();
  });
}

// ─── 工作流列表渲染 ─────────────────────────────

async function renderWorkflowList() {
  const list = document.getElementById('list-workflows');
  if (!list) return;

  const workflows = await WorkflowManager.getAll();
  list.innerHTML = '';

  if (workflows.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-secondary);';
    empty.textContent = '暂无已注册工作流';
    list.appendChild(empty);
    return;
  }

  workflows.forEach(w => {
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg-dark,#1e1e2e);border:1px solid var(--border-color,#333);border-radius:8px;padding:16px;margin-bottom:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333;padding-bottom:10px;margin-bottom:10px;">
        <h4 style="margin:0;color:#fff;font-size:1.1rem;font-weight:600;">${w.name}</h4>
      </div>
      <div style="font-size:0.85rem;color:#aaa;line-height:1.6;">
        <p style="margin:0;"><strong>步骤数:</strong> <span style="color:#4da6ff;">${w.steps.length} 步</span></p>
      </div>
    `;
    list.appendChild(div);
  });
}

// ─── 自动播种默认武器 ────────────────────────────────

async function seedDefaultTools() {
  const existing = await ToolManager.getAll();
  const existingIds = new Set(existing.map(t => t.id || t.uid));

  const defaults = [
    {
      id: 'web_search',
      uid: 'core.web_search',
      name: '网页搜索',
      author: 'Niko_Admin',
      version: '1.0.0',
      description: '在互联网上搜索信息，返回相关结果。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' }
        },
        required: ['query']
      },
      execution: {
        type: 'local_cmd',
        template: 'echo 模拟搜索：{{query}}'
      },
      createdAt: new Date().toISOString()
    },
    {
      id: 'local_commander',
      uid: 'core.local_commander',
      name: '本地命令执行',
      author: 'Niko_Admin',
      version: '1.0.0',
      description: '在本地系统上执行命令或脚本。',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: '要执行的命令或指令' }
        },
        required: ['instruction']
      },
      execution: {
        type: 'local_cmd',
        template: '{{instruction}}'
      },
      createdAt: new Date().toISOString()
    },
    // ─── 🗡️ 三把工业级武器 ─────────────────────────
    {
      id: 'file_writer',
      uid: 'core.file_writer',
      name: '文件手术刀',
      author: 'Niko_Admin',
      version: '1.0.0',
      description: '精准写入文件到沙盒工作区，无转义地狱，自动创建目录',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '文件路径（相对 .workspace 沙盒）' },
          content: { type: 'string', description: '文件内容' }
        },
        required: ['filename', 'content']
      },
      execution: {
        type: 'go_bridge',
        endpoint: '/api/tools/write_file'
      },
      createdAt: new Date().toISOString()
    },
    {
      id: 'web_reader',
      uid: 'core.web_reader',
      name: '深网穿透器',
      author: 'Niko_Admin',
      version: '1.0.0',
      description: '读取任意 URL 的完整页面内容，自动提取纯文本（HTML→Text）',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '目标网页 URL' }
        },
        required: ['url']
      },
      execution: {
        type: 'go_bridge',
        endpoint: '/api/tools/read_web'
      },
      createdAt: new Date().toISOString()
    },
    {
      id: 'system_notify',
      uid: 'core.system_notify',
      name: '赛博传呼机',
      author: 'Niko_Admin',
      version: '1.0.0',
      description: '发送系统桌面原生通知（Windows Toast / Mac 通知中心 / Linux notify-send）',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '通知标题' },
          message: { type: 'string', description: '通知正文' }
        },
        required: ['title', 'message']
      },
      execution: {
        type: 'go_bridge',
        endpoint: '/api/tools/notify'
      },
      createdAt: new Date().toISOString()
    }
  ];

  for (const tool of defaults) {
    if (!existingIds.has(tool.id)) {
      await ToolManager.save(tool);
    }
  }
}

// ─── 初始化 ────────────────────────────────

export function initPanels() {
  setupProviderForm();
  setupAgentForm();
  setupWorkflowForm();
  setupToolForm();

  // 级联选择器联动
  const providerSel = document.getElementById('agent-provider-select');
  if (providerSel) {
    providerSel.addEventListener('change', renderModelSelect);
  }

  // ─── 工作区挂载状态 ─────────────────────────
  // Agent 面板激活时刷新状态
  EventBus.on('ui_tab_switched', ({ target }) => {
    if (target === 'agents') {
      const wsInput = document.getElementById('agent-workspace-input');
      const ws = wsInput ? wsInput.value.trim() || '.workspace' : '.workspace';
      renderWorkspaceStatus(ws);
    }
  });

  // Agent 表单内的「打开工作区」按钮
  const openWsBtn = document.getElementById('btn-open-ws-from-agent');
  if (openWsBtn) {
    openWsBtn.addEventListener('click', async () => {
      const wsInput = document.getElementById('agent-workspace-input');
      const ws = wsInput ? wsInput.value.trim() || '.workspace' : '.workspace';
      openWsBtn.textContent = '⏳ 打开中...';
      await openWorkspace(ws);
      setTimeout(() => { openWsBtn.textContent = '📂 打开'; }, 2000);
    });
  }

  // 事件驱动刷新
  const refreshProviders = () => {
    renderProviderList();
    renderProviderSelect();
  };
  const refreshAgents = () => renderAgentList();
  const refreshWorkflows = () => renderWorkflowList();
  const refreshTools = () => {
    renderToolList();
    renderToolCheckboxes();
  };

  EventBus.on('app_ready', async () => {
    await seedDefaultTools();
    refreshProviders();
    refreshAgents();
    refreshWorkflows();
    refreshTools();
    // 默认在 providers 面板，首次不刷新 agents 状态
  });

  EventBus.on('provider_updated', refreshProviders);
  EventBus.on('agent_updated', refreshAgents);
  EventBus.on('workflow_updated', refreshWorkflows);
  EventBus.on('tool_updated', refreshTools);
}
