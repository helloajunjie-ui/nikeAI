# NikoAI — 技术宪法

> **宣言**：极简、解耦、原生。拒绝框架臃肿，拥抱浏览器本质。

---

## 一、终极技术栈

| 层级 | 技术选型 | 约束 |
|------|----------|------|
| **大脑前端 (Web Core)** | Pure HTML/CSS + Native Vanilla JS (ES6 Modules) | ❌ 禁止 Node.js / Webpack / React / Vue / 任何构建工具 |
| **持久化** | 浏览器原生 IndexedDB | 无第三方依赖 |
| **本地义体 (Local Bridge)** | Golang (Go) | 编译为单 `.exe` 幽灵进程，后台运行 HTTP Server |
| **通信协议** | HTTP (fetch) + EventBus (Pub/Sub) | 前端 ↔ Go 本地节点通过跨域请求交互 |

### 核心原则

- **零构建**：浏览器直接加载 ESM `type="module"`，无需打包。
- **零运行时依赖**：所有代码手写原生 JS，无 `node_modules`。
- **Go 节点**：仅负责 OS 级操作（文件读写、启动本地软件），不做业务逻辑。

---

## 二、领域驱动目录规范 (Native ESM Structure)

```
nikoaio/
├── index.html                  # 入口 SPA
├── styles/
│   └── main.css                # 全局样式
├── scripts/
│   ├── main.js                 # 系统总闸 (Bootstrapper)
│   ├── core/                   # 核心状态机 —— 绝不操作 DOM
│   │   ├── eventBus.js         # 轻量级 EventBus (Pub/Sub)
│   │   ├── registry.js         # DexieManager (Provider/Agent/Tool/Workflow)
│   │   ├── engine.js           # 双轨道引擎 (Track A 流水线 + Track B ReAct)
│   │   └── llm_api.js          # LLM API 客户端（无状态 fetch）
│   ├── store/
│   │   └── indexeddb.js        # IndexedDB 持久化层 (StorageEngine) — 已废弃
│   ├── plugins/                # 插件池 —— Tool Manifests + 物理义体
│   │   ├── manifests.js        # 5 把武器的 Manifest 定义 + getOpenAITools()
│   │   ├── web_tools.js        # Web 工具实现 (executeWebSearch)
│   │   ├── local_bridge.js     # 本地节点遥控器 + goBridgeTool() + openWorkspace()
│   │   └── executor.js         # 义体路由器 (local_cmd / go_bridge / web_api)
│   └── ui/                     # UI 层 —— 纯 DOM 渲染
│       ├── navigation.js       # Tab + 模式切换 (暴露 getCurrentMode)
│       ├── config_panel.js     # 配置面板表单 + 列表渲染 + seedDefaultTools()
│       └── chat_terminal.js    # 聊天终端控制器 + LiveStatus 遥测单例
├── bridge/                     # Go 本地幽灵节点 v3 (独立目录)
│   ├── main.go                 # HTTP Server + CORS + 沙盒 + 3 武器路由
│   └── run.bat                 # 快速启动脚本
├── ARCHITECTURE.md             # 本文件
└── readme.md                   # 产品介绍
```

### 铁律

- **`/core`**：纯逻辑，不导入任何 UI 模块，不操作 `document`。
- **`/ui`**：纯渲染，通过 EventBus 订阅状态变更，不直接操作 `/store`。
- **`/store`**：纯数据，导出 async CRUD 函数，不关心谁调用。
- **`/plugins`**：纯工具函数，接收参数返回结果，无副作用。

---

## 三、事件驱动架构 (EventBus)

底层与 UI 之间通过 **EventBus (Pub/Sub)** 完全解耦。

### 事件通道定义

| 事件名 | 方向 | 载荷 | 说明 |
|--------|------|------|------|
| `app_ready` | core → ui | `{ timestamp }` | 引擎初始化完成 |
| `chat_request_submitted` | ui → core | `{ agentId, text }` | 用户发送消息 (Track B) |
| `workflow_request_submitted` | ui → core | `{ workflowId, userInput }` | 用户触发流水线 (Track A) |
| `chat_render_log` | core → ui | `{ text }` | 引擎回传日志 |
| `ui_tab_switched` | ui → ui | `{ target }` | 面板切换 |
| `ui_mode_switched` | ui → ui | `{ mode }` | 终端/流水线模式切换 |
| `provider_updated` | ui → ui | — | Provider 数据变更 |
| `agent_updated` | ui → ui | — | Agent 数据变更 |
| `workflow_updated` | ui → ui | — | Workflow 数据变更 |

---

## 四、三大数据资产中心 (The 3 Registries)

### 4.1 AI 管理库 (私有)

管理 AI Providers 和 Agents 的配置。

**Provider Schema**
```json
{
  "id": "uuid",
  "name": "我的 OpenAI",
  "url": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "models": ["gpt-4", "gpt-3.5-turbo"],
  "createdAt": "ISO8601"
}
```

**Agent Schema**
```json
{
  "id": "uuid",
  "name": "代码助手",
  "providerId": "关联 Provider ID",
  "model": "gpt-4",
  "prompt": "你是一个...",
  "tools": ["web_search", "local_commander"],
  "createdAt": "ISO8601"
}
```

### 4.2 通用工具库 (公共)

基于 Manifest 协议的插件池。

**Plugin Manifest Schema**
```json
{
  "id": "web_search",
  "name": "全网搜索",
  "description": "搜索实时网络信息",
  "type": "web",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "搜索关键词" }
    },
    "required": ["query"]
  }
}
```

### 4.3 工作流库 (SOP)

基于 JSON 的固定流水线图纸。步骤通过 `artifacts` 对象隐式传递数据。

**Workflow Schema**
```json
{
  "id": "uuid",
  "name": "日报生成",
  "steps": [
    {
      "type": "llm",
      "providerId": "provider-uuid",
      "model": "gpt-4",
      "systemPrompt": "你是一个日报助手",
      "prompt": "请根据以下信息生成日报：{{userInput}}"
    },
    {
      "type": "tool",
      "toolId": "local_commander",
      "params": {
        "instruction": "echo {{artifacts.step_0}} > report.md"
      }
    }
  ],
  "createdAt": "ISO8601"
}
```

**步骤类型说明：**
- `type: "llm"` — 调用 LLM，prompt 支持 `{{userInput}}` 和 `{{artifacts.step_N}}` 插值
- `type: "tool"` — 调用工具，params 中所有字符串值支持插值
- 步骤输出自动存入 `artifacts.step_{index}`，供后续步骤引用

---

## 五、双引擎路由 (Dual-Engine)

### 轨道 A：图纸控制 (Workflow-Routed) — 确定性流水线

```
用户触发 Workflow (workflow_request_submitted)
    ↓
Engine 加载 workflow.steps[]
    ↓
for (let i = 0; i < steps.length; i++):
    const step = steps[i]
    ├── type: "llm"
    │     → interpolate(prompt, { userInput, artifacts })
    │     → callLLM(provider, model, messages)
    │     → artifacts.step_{i} = LLM response
    │
    └── type: "tool"
          → interpolate(params, { userInput, artifacts })
          → runTool(toolId, params)
          → artifacts.step_{i} = tool result
    ↓
流水线完成 → [System] 🎉 执行完毕
```

**插值引擎 `interpolate()`：**
- `{{userInput}}` → 用户原始输入
- `{{artifacts.step_0}}`, `{{artifacts.step_1}}` ... → 前序步骤的输出
- 未匹配的占位符保持原样

### 轨道 B：AI 控制 (Agent-Routed) — ReAct 循环

```
用户发送消息 (chat_request_submitted)
    ↓
Engine 组装 messages (system + user) + tools
    ↓
while (iterations < 5):
    callLLM() → messages.push(AI reply)
    ├── tool_calls → runTool() → messages.push({ role: 'tool' }) → continue
    └── content    → 渲染到 UI → break
    ↓
iterations >= 5 → [System] ⛔ 引擎思考超时，强制终止
```

---

## 六、本地义体 (Go Bridge v3)

### 已实现

[`bridge/main.go`](bridge/main.go) — 纯标准库 HTTP Server，v3 新增三把工业级武器路由。

| 功能 | 实现 |
|------|------|
| **监听地址** | `127.0.0.1:11451` |
| **CORS** | 全量放行，拦截 OPTIONS 预检 |
| **路由 `/execute`** | POST 接收 `{"instruction":"..."}` |
| **路由 `/open-workspace`** | POST 调用 OS 文件管理器打开沙盒目录 |
| **路由 `/api/tools/write_file`** | POST 精准写入文件到沙盒 (os.WriteFile) |
| **路由 `/api/tools/read_web`** | POST HTTP GET + stripHTML() 提取纯文本 |
| **路由 `/api/tools/notify`** | POST 发送 OS 原生桌面通知 |
| **命令执行** | Windows: `cmd /c`，Mac/Linux: `sh -c` |
| **沙盒 CWD 锁定** | `cmd.Dir = WORKSPACE_DIR`，所有命令默认在 `.workspace` 执行 |
| **逃逸拦截** | `containsEscapeAttempt()` 检测 `cd ..` / `cd..` / `cd %` / `cd /d` |
| **沙盒路径** | 自动解析项目根目录，支持 `go run` 和编译后两种模式 |
| **启动** | `go run ./bridge/main.go`（从项目根）或双击 `bridge/run.bat` |

### 三把工业级武器

#### 🗡️ 武器 1：文件手术刀 (`/api/tools/write_file`)

```go
// 核心逻辑：os.WriteFile 直接写入，无 shell 转义
// 安全防护：路径逃逸检测 + 沙盒边界校验
func handleWriteFile(w http.ResponseWriter, r *http.Request) {
    // 1. 解析 { filename, content }
    // 2. 校验 filename 不能为空
    // 3. 拼接沙盒路径，校验 absTarget 必须在 absWorkspace 内
    // 4. os.MkdirAll 确保目录存在
    // 5. os.WriteFile 写入
}
```

**为什么不用 shell echo？** shell 转义是安全黑洞——文件名含空格/特殊字符/中文时极易出错。`os.WriteFile` 是二进制级精准写入，零转义问题。

#### 👁️ 武器 2：深网穿透器 (`/api/tools/read_web`)

```go
// 核心逻辑：HTTP GET → 自定义 stripHTML() → 纯文本
// 安全防护：8000 字符截断防 token 爆炸
func handleReadWeb(w http.ResponseWriter, r *http.Request) {
    // 1. 解析 { url }
    // 2. http.Get(url)
    // 3. io.ReadAll(resp.Body)
    // 4. stripHTML(html) 提取纯文本
    // 5. 截断至 8000 字符
}
```

`stripHTML()` 是手写的有限状态机——跳过 `<script>` 和 `<style>` 块，转义 HTML 实体（`&` `<` `>` `&#34;` `'`），合并连续空白。零第三方依赖。

#### 🔔 武器 3：赛博传呼机 (`/api/tools/notify`)

```go
// 核心逻辑：跨平台 OS 原生通知
func handleNotify(w http.ResponseWriter, r *http.Request) {
    switch runtime.GOOS {
    case "windows":
        // PowerShell Windows.UI.Notifications Toast API
    case "darwin":
        // osascript display notification
    default:
        // notify-send (Linux)
    }
}
```

### 前端调用链路

```
chat_terminal.js → EventBus → engine.js
    → executor.js (local_cmd / go_bridge 路由)
    → local_bridge.js (executeLocalCommand / goBridgeTool)
    → fetch('http://127.0.0.1:11451/<endpoint>')
    → Go Bridge v3 → 返回结果
```

### 义体路由器 (executor.js)

[`executor.js`](scripts/plugins/executor.js) 根据工具的 `execution.type` 动态路由：

| execution.type | 路由目标 | 示例工具 |
|----------------|----------|----------|
| `local_cmd` | `executeLocalCommand()` | `local_commander`, `web_search` |
| `go_bridge` | `goBridgeTool(endpoint, args)` | `file_writer`, `web_reader`, `system_notify` |
| `web_api` | 预留 fetch 路由 | — |

### 种子武器注册 (config_panel.js)

[`config_panel.js`](scripts/ui/config_panel.js) 的 `seedDefaultTools()` 在 `app_ready` 事件触发时自动注册 5 把默认武器到 Dexie 数据库：

| 工具 ID | 类型 | execution |
|---------|------|-----------|
| `web_search` | `local_cmd` | `echo 模拟搜索：{{query}}` |
| `local_commander` | `local_cmd` | `{{instruction}}` |
| `file_writer` | `go_bridge` | `endpoint: /api/tools/write_file` |
| `web_reader` | `go_bridge` | `endpoint: /api/tools/read_web` |
| `system_notify` | `go_bridge` | `endpoint: /api/tools/notify` |

采用**增量补充**策略：只写入数据库中不存在的工具 ID，已存在的保留用户自定义配置。

### 沙盒架构图

```
┌─ 浏览器 ──────────────────────────────────────┐
│  engine.js → System Prompt（极客版，无绝对路径） │
│  "你已被物理挂载至独立的沙盒工作区"              │
└──────────────────────┬────────────────────────┘
                       │
┌─ Go Bridge v3 ───────▼────────────────────────┐
│  containsEscapeAttempt()  ← 🚫 cd .. 拦截      │
│  cmd.Dir = WORKSPACE_DIR  ← 🔒 CWD 锁定        │
│  /open-workspace          ← 📁 打开工作区       │
│  /api/tools/write_file    ← 🗡️ 文件手术刀       │
│  /api/tools/read_web      ← 👁️ 深网穿透器       │
│  /api/tools/notify        ← 🔔 赛博传呼机       │
└──────────────────────┬────────────────────────┘
                       │ exec.Command / os.WriteFile / http.Get
┌─ OS ─────────────────▼────────────────────────┐
│  cmd /c <指令>  (CWD: .workspace/)             │
│  AI 的世界被死死锁在 .workspace 这个小盒子里     │
└────────────────────────────────────────────────┘
```

---

## 七、实时遥测 (Live Telemetry)

### 设计目标

消除 Agent 后台执行时的**等待焦虑**，将引擎的每一次心跳转化为视觉上的安全感。

### 实现

| 文件 | 组件 | 职责 |
|------|------|------|
| [`styles/main.css`](styles/main.css:419) | `.agent-status-live` / `.spinner` / `.cursor` | 赛博齿轮旋转 + 呼吸闪烁光标 |
| [`scripts/ui/chat_terminal.js`](scripts/ui/chat_terminal.js:143) | `LiveStatus` 单例 | `show(text)` 幂等唤醒 / `clear()` 销毁 |
| [`scripts/core/engine.js`](scripts/core/engine.js:80) | ReAct 循环遥测 | 思考中 → 调工具 → 执行完毕 全链路状态 |
| [`scripts/plugins/executor.js`](scripts/plugins/executor.js:1) | 工具执行遥测 | 执行前显示工具名，执行后清除 |

### 遥测状态流

```
🧠 V8 引擎思考中... 第 1/20 回合
    ↓ (AI 决定调工具)
⚡ 触发武器库！AI 决定调用：local_commander
    ↓
🔧 正在执行 local_commander...
    ↓ (工具返回)
[状态条自动清除] → 渲染 AI 回答
```

---

## 八、安全与边界

| 关注点 | 策略 |
|--------|------|
| API Key 存储 | IndexedDB 加密存储（至少 Base64 混淆，未来可引入 Web Crypto API） |
| XSS | 所有 AI 输出经 `textContent` 或 DOMPurify 后渲染 |
| CORS | Go 本地节点设置 `Access-Control-Allow-Origin: *` |
| Function Call 校验 | 参数白名单校验，防止注入 |
| IndexedDB 版本 | 使用版本号迁移策略，避免数据结构不兼容 |
| **沙盒逃逸** | **Go Bridge 层 `containsEscapeAttempt()` 拦截 `cd ..` 等逃逸指令** |
| **文件隔离** | **所有 OS 命令 CWD 锁定在 `.workspace`，物理上无法写沙盒外** |

---

## 九、UI/UX 设计原则

- **骨架屏优先**：所有面板加载时先显示骨架屏，再填充内容。
- **空状态设计**：无数据时显示引导提示，而非空白页。
- **丝滑过渡**：面板切换使用 CSS `transition` + `transform`，无闪跳。
- **响应式**：CSS Grid/Flexbox 自适应，桌面优先但兼容平板。
- **暗色模式**：CSS 变量驱动，一键切换。
- **实时遥测**：Agent 执行期间显示脉冲动画状态条，消除等待焦虑。
- **工作区入口**：左侧导航栏底部常驻 `📁 打开工作区` 按钮，一键弹出沙盒目录。

---

> **本宪法为 NikoAI 项目的最高技术指导文件。所有代码提交必须遵守上述目录规范、模块边界和事件驱动原则。违反者视为架构违规，需重构。**
