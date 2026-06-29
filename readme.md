# ⎔ NikoAI

**Edge Agentic Engine — 浏览器里的自主智能体编排引擎**

> 不套壳，不联网，不偷数据。你的 AI 打工人，完全运行在你的浏览器里。

---

## 这是什么？

NikoAI 是一个完全运行在浏览器端侧的 **Serverless 自主智能体编排平台**。

你可以把它理解为你的**数字无人工厂**——在这里，你可以配置 AI 打工人、给他们装备工具、编排自动化流水线，所有数据永远留在你自己的电脑里。

---

## 三大核心资产

### 🤖 角色定义 (AI Management)
配置你的 AI 打工人。绑定模型、设定人格、分配专属工具库。私有配置，永久锁定在浏览器沙盒中。

### 🔧 工具库 (Tool Plugin Pool)
系统的「机械义体」。基于 Manifest 协议的轻量插件池——向外可搜索网页、抓取信息、读取任意 URL 全文；向内可精准写入文件、遥控本地软件、发送系统原生通知（通过 Go 本地幽灵节点 v3）。

### ⎔ 工作流 (Workflow SOPs)
人类 Know-How 的沉淀。用 JSON 编排自动化流水线，支持 LLM 调用与工具执行的混合编排，步骤间通过 `artifacts` 自动传递数据。一键复制分享，全球复用。

---

## 双模式引擎

| 模式 | 谁控制 | 适合场景 |
|------|--------|----------|
| **⎔ 流水线模式** | 人类编写的 JSON 流程 (Track A) | 每日新闻抓取、代码审查等确定性任务 |
| **>_ 终端模式** | AI 自主思考决策 — ReAct 循环 (Track B) | 模糊意图、复杂多步推理等探索性任务 |

切换模式时，终端选择器自动切换为特工列表或工作流列表。

---

## 设计哲学

- **极致隐私**：零后端，所有数据在浏览器 IndexedDB 闭环
- **降噪美学**：暗色主题，领域驱动界面，只呈现必要信息
- **协议驱动**：工具表单由 Manifest 自动生成，无需手写 UI
- **双轨并行**：确定性流水线与 AI 自主决策，各司其职

---

## 快速开始

### 启动前端
> 纯静态项目，无需构建，无需安装。

```bash
# 用任意 HTTP Server 打开 index.html
python -m http.server 3000
# 浏览器访问 http://localhost:3000
```

### 启动本地幽灵节点 (可选)
需要 [Go 语言环境](https://go.dev/dl/)。

```bash
# 从项目根目录启动（沙盒路径自动解析）
go run ./bridge/main.go
# 或直接双击 bridge/run.bat
```

节点启动后，AI 特工即可使用以下 **5 把武器**：

| 武器 | 工具 ID | 能力 |
|------|---------|------|
| 🗡️ 文件手术刀 | `file_writer` | 精准写入文件到沙盒，无 shell 转义 |
| 👁️ 深网穿透器 | `web_reader` | 读取任意 URL 全文，HTML→纯文本 |
| 🔔 赛博传呼机 | `system_notify` | 发送系统桌面原生通知 |
| 🔧 本地命令执行 | `local_commander` | 在沙盒内执行 OS 命令 |
| 🌐 网页搜索 | `web_search` | 搜索实时网络信息 |

所有文件操作默认锁定在 **`.workspace` 沙盒目录**内，防止 AI 逃逸到宿主机。

---

## 项目结构

```
nikoaio/
├── index.html              # 入口 SPA
├── styles/main.css         # 全局样式 + Live Telemetry 脉冲光效
├── scripts/
│   ├── main.js             # 系统总闸
│   ├── core/               # 核心引擎 (EventBus / Registry / 双轨道引擎 / LLM API)
│   │   └── engine.js       # 自动注入沙盒纪律到 System Prompt
│   ├── store/              # IndexedDB 持久化 (Dexie.js)
│   ├── plugins/            # 工具协议 + 物理义体
│   │   ├── manifests.js    # 5 把武器的 Manifest 定义
│   │   ├── executor.js     # 义体路由器 (local_cmd / go_bridge / web_api)
│   │   ├── local_bridge.js # 本地节点遥控器 + goBridgeTool() + openWorkspace()
│   │   └── web_tools.js    # Web 工具实现
│   └── ui/                 # 渲染层 (导航 / 配置面板 / 终端)
│       ├── chat_terminal.js# LiveStatus 实时遥测单例
│       ├── config_panel.js # 配置面板 + seedDefaultTools() 种子武器
│       └── navigation.js   # 📁 打开工作区按钮
├── .workspace/             # 🔒 AI 沙盒工作区（自动创建）
├── bridge/                 # Go 本地幽灵节点 v3
│   ├── main.go             # HTTP Server + CORS + CWD 锁定 + 逃逸拦截 + 3 武器路由
│   └── run.bat             # 自动 cd 到项目根启动
├── ARCHITECTURE.md         # 技术宪法
└── readme.md               # 本文件
```

---

## 工作流示例

在流水线模式下，粘贴以下 JSON 即可创建一个「代码审查 + 报告生成」流水线：

```json
[
  {
    "type": "llm",
    "providerId": "你的 Provider ID",
    "model": "gpt-4",
    "systemPrompt": "你是一位资深代码审查专家",
    "prompt": "请审查以下代码，指出潜在问题：\n\n{{userInput}}"
  },
  {
    "type": "tool",
    "toolId": "local_commander",
    "params": {
      "instruction": "echo {{artifacts.step_0}} > review_report.md"
    }
  }
]
```

---

*NikoAI — 你的浏览器，你的智能体工厂。*
