/**
 * NikoAI — UI 导航控制器
 * 管理左侧 Tab 切换与顶部模式切换。
 * 纯 DOM 操作，通过 EventBus 通知底层。
 */

import { EventBus } from '../core/eventBus.js?v=20260629f';
import { openWorkspace } from '../plugins/local_bridge.js?v=20260629f';

let _currentMode = 'terminal';

export function getCurrentMode() {
  return _currentMode;
}

export function initNavigation() {
  // --- 左侧 Tab 切换 ---
  const tabBtns = document.querySelectorAll('.tab-btn:not(.workspace-btn)');
  const panels = {
    providers: document.getElementById('panel-providers'),
    agents: document.getElementById('panel-agents'),
    tools: document.getElementById('panel-tools'),
    workflows: document.getElementById('panel-workflows')
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.panel;

      // 切换 Tab 按钮样式
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 切换面板显示
      Object.entries(panels).forEach(([key, el]) => {
        if (el) el.classList.toggle('active', key === target);
      });

      EventBus.emit('ui_tab_switched', { target });
    });
  });

  // --- 📁 打开工作区按钮 ---
  const wsBtn = document.getElementById('btn-open-workspace');
  if (wsBtn) {
    wsBtn.addEventListener('click', async () => {
      wsBtn.textContent = '⏳ 打开中...';
      const result = await openWorkspace();
      console.log('[Workspace]', result);
      setTimeout(() => {
        wsBtn.textContent = '📁 打开工作区';
      }, 2000);
    });
  }

  // --- 顶部模式切换 ---
  const modeBtns = document.querySelectorAll('.mode-btn');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      _currentMode = btn.dataset.mode;
      EventBus.emit('ui_mode_switched', { mode: _currentMode });
    });
  });
}
