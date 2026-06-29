/**
 * NikoAI — 系统总闸 (Bootstrapper)
 * 整个 App 的唯一入口。
 * 初始化引擎，触发 app_ready 事件。
 */

import { EventBus } from './core/eventBus.js?v=20260629f';
import { ProviderManager, AgentManager, WorkflowManager } from './core/registry.js?v=20260629f';
import { initNavigation } from './ui/navigation.js?v=20260629f';
import { initPanels } from './ui/config_panel.js?v=20260629f';
import { initChatTerminal } from './ui/chat_terminal.js?v=20260629f';
import { initEngine } from './core/engine.js?v=20260629f';

async function init() {
  // 初始化 UI 控制器
  initNavigation();
  initPanels();
  initChatTerminal();

  // 初始化核心引擎
  initEngine();

  console.log(
    '%c[NikoAI] Edge Agentic Engine initialized.',
    'color: #3fb950; font-weight: bold; font-size: 14px;'
  );

  EventBus.emit('app_ready', { timestamp: Date.now() });
}

document.addEventListener('DOMContentLoaded', init);
