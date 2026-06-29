/**
 * NikoAI — 聊天终端控制器
 * 特工/工作流选择器联动 + 回车发送 + Markdown 日志渲染。
 * 纯 DOM 操作，通过 EventBus 与底层通信。
 */

import { EventBus } from '../core/eventBus.js?v=20260629f';
import { AgentManager, WorkflowManager } from '../core/registry.js?v=20260629f';
import { getCurrentMode } from './navigation.js?v=20260629f';

// ─── 配置 marked 使用 highlight.js ────────────────
if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
  marked.setOptions({
    highlight: function(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  });
}

let _selectedId = '';

function renderSelector() {
  const sel = document.getElementById('chat-agent-selector');
  if (!sel) return;
  const currentVal = sel.value;
  const mode = getCurrentMode();

  if (mode === 'pipeline') {
    sel.innerHTML = '<option value="">-- 请选择工作流 --</option>';
    WorkflowManager.getAll().then(workflows => {
      workflows.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        sel.appendChild(opt);
      });
      sel.value = currentVal;
    });
  } else {
    sel.innerHTML = '<option value="">-- 请选择出战特工 --</option>';
    AgentManager.getAll().then(agents => {
      agents.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        sel.appendChild(opt);
      });
      sel.value = currentVal;
    });
  }
}

function renderChatLog(text) {
  const log = document.getElementById('chat-log');
  if (!log) return;

  const line = document.createElement('div');
  line.className = 'chat-line';

  // 分类渲染：System / User / AI (Markdown)
  if (text.startsWith('[System]')) {
    line.className = 'chat-line log-system';
    line.textContent = text;
  } else if (text.startsWith('> User:')) {
    line.className = 'chat-line log-user';
    line.textContent = text;
  } else if (text.startsWith('> AI:')) {
    line.className = 'chat-line log-ai';
    // 去掉 "> AI: " 前缀，剩余内容做 Markdown 渲染
    const mdContent = text.slice(5).trim();
    if (typeof marked !== 'undefined') {
      line.innerHTML = marked.parse(mdContent);
    } else {
      line.textContent = mdContent;
    }
  } else {
    // 兜底：普通文本
    line.textContent = text;
  }

  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function setupChatInput() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (!_selectedId) {
        renderChatLog('[System] 请先选择出战特工或工作流');
        return;
      }
      input.value = '';
      renderChatLog(`> User: ${text}`);

      const mode = getCurrentMode();
      if (mode === 'pipeline') {
        EventBus.emit('workflow_request_submitted', {
          workflowId: _selectedId,
          userInput: text
        });
      } else {
        EventBus.emit('chat_request_submitted', {
          agentId: _selectedId,
          text
        });
      }
    }
  });
}

function setupSelector() {
  const sel = document.getElementById('chat-agent-selector');
  if (!sel) return;
  sel.addEventListener('change', () => {
    _selectedId = sel.value;
  });
}

export function initChatTerminal() {
  renderSelector();
  setupSelector();
  setupChatInput();

  // 监听数据变更刷新选择器
  EventBus.on('app_ready', renderSelector);
  EventBus.on('agent_updated', renderSelector);
  EventBus.on('workflow_updated', renderSelector);

  // 模式切换时刷新选择器
  EventBus.on('ui_mode_switched', renderSelector);

  // 监听引擎渲染事件
  EventBus.on('chat_render_log', (data) => {
    renderChatLog(data.text);
  });
}

/**
 * LiveStatus — V8 引擎实时遥测状态单例
 * 保证页面上永远只有一个"正在执行"的状态条，可随时替换文本或销毁。
 */
export const LiveStatus = {
    element: null,

    /**
     * 唤醒状态条
     * @param {string} text - 遥测文本，如 "正在调用物理武器: local_commander..."
     */
    show(text) {
        const container = document.getElementById('chat-log');
        if (!container) return;

        if (this.element) {
            this.element.querySelector('.status-text').textContent = text;
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'agent-status-live';
        this.element.innerHTML = `
            <span class="agent-status-spinner"></span>
            <span class="status-text">${text}</span>
            <span class="agent-status-cursor"></span>
        `;
        container.appendChild(this.element);
        container.scrollTop = container.scrollHeight;
    },

    /** 动作完成，抹除状态条 */
    clear() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
        }
    }
};
