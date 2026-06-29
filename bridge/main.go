// NikoAI — 本地幽灵节点 (Niko-Bridge)
// 极轻量 HTTP Server，编译为单 .exe，在系统后台运行。
// 纯标准库，零第三方依赖。
//
// 职责：接收前端跨域请求，执行本地 OS 命令，返回结果。
// v2 — 沙盒模式：所有命令在 .workspace 目录内执行，防止 AI 裸奔。

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ─── 沙盒常量 ──────────────────────────────────
// WORKSPACE_DIR 是 AI 的专属工作区，所有命令默认在此目录执行。
// 通过 os.Getwd() 获取项目根目录（go run 时即为项目根），拼接 .workspace。
var WORKSPACE_DIR string

func init() {
	wd, err := os.Getwd()
	if err != nil {
		log.Fatalf("[Niko-Bridge] 无法获取工作目录: %v", err)
	}
	// 如果当前在 bridge/ 子目录，回退到父目录
	if filepath.Base(wd) == "bridge" {
		wd = filepath.Dir(wd)
	}
	WORKSPACE_DIR = filepath.Join(wd, ".workspace")

	// 确保目录存在
	if err := os.MkdirAll(WORKSPACE_DIR, 0755); err != nil {
		log.Fatalf("[Niko-Bridge] 无法创建沙盒工作区 %s: %v", WORKSPACE_DIR, err)
	}

	absDir, _ := filepath.Abs(WORKSPACE_DIR)
	log.Printf("[Niko-Bridge] 🏗️ 沙盒工作区: %s", absDir)
}

// ─── 请求/响应结构 ─────────────────────────────

type ExecuteRequest struct {
	Instruction string `json:"instruction"`
	Workspace   string `json:"workspace,omitempty"` // 可选：特工自定义工作区
}

type ExecuteResponse struct {
	Status string `json:"status"`
	Output string `json:"output,omitempty"`
	Error  string `json:"error,omitempty"`
}

// ─── 三把工业级武器的请求结构 ────────────────────

type WriteFileRequest struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

type ReadWebRequest struct {
	Url string `json:"url"`
}

type NotifyRequest struct {
	Title   string `json:"title"`
	Message string `json:"message"`
}

// ─── CORS 中间件 ───────────────────────────────

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next(w, r)
	}
}

// ─── 逃逸检测 ──────────────────────────────────
// 检查指令是否试图逃逸沙盒（cd .. / cd ../../ 等）
func containsEscapeAttempt(instruction string) bool {
	// 匹配 cd ..、cd..、cd %、cd /d 等逃逸模式（大小写不敏感）
	lower := instruction
	patterns := []string{
		"cd ..",
		"cd..",
		"cd %",
		"cd /d",
	}
	for _, p := range patterns {
		for i := 0; i <= len(lower)-len(p); i++ {
			match := true
			for j := 0; j < len(p); j++ {
				c1 := lower[i+j]
				c2 := p[j]
				if c1 >= 'A' && c1 <= 'Z' {
					c1 += 32
				}
				if c1 != c2 {
					match = false
					break
				}
			}
			if match {
				return true
			}
		}
	}
	return false
}

// resolveWorkspace 解析工作区路径
// 如果传入了自定义 workspace，使用它；否则使用默认 WORKSPACE_DIR
func resolveWorkspace(workspace string) string {
	if workspace != "" {
		// 如果是相对路径，拼接到项目根目录
		if !filepath.IsAbs(workspace) {
			wd, _ := os.Getwd()
			if filepath.Base(wd) == "bridge" {
				wd = filepath.Dir(wd)
			}
			return filepath.Join(wd, workspace)
		}
		return workspace
	}
	return WORKSPACE_DIR
}

// ─── 命令执行（沙盒模式）────────────────────────

func executeInstruction(instruction string, workspace string) ExecuteResponse {
	// 🚫 逃逸拦截：防止 cd .. 跳出沙盒
	if containsEscapeAttempt(instruction) {
		return ExecuteResponse{
			Status: "error",
			Error:  "[安全拦截] 权限拒绝：禁止逃逸挂载的工作区！",
		}
	}

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", instruction)
	default:
		cmd = exec.Command("sh", "-c", instruction)
	}

	// 🔒 物理挂载：解析特工自定义工作区，或使用默认 .workspace
	workDir := resolveWorkspace(workspace)
	// 确保目录存在
	os.MkdirAll(workDir, 0755)
	cmd.Dir = workDir

	output, err := cmd.CombinedOutput()
	if err != nil {
		return ExecuteResponse{
			Status: "error",
			Error:  fmt.Sprintf("%s: %s", err.Error(), string(output)),
		}
	}

	return ExecuteResponse{
		Status: "success",
		Output: string(output),
	}
}

// ─── 🗡️ 武器 1: 文件手术刀 ─────────────────────
// 精准防弹写入，无转义地狱

func handleWriteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"status":"error","error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req WriteFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: err.Error()})
		return
	}

	// 安全校验：防止路径逃逸（只允许相对路径，禁止 ..）
	if req.Filename == "" {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: "filename 不能为空"})
		return
	}

	// 拼接沙盒路径
	targetPath := filepath.Join(WORKSPACE_DIR, req.Filename)
	// 确保目标在沙盒内（防止 filename 包含 ../../）
	absTarget, _ := filepath.Abs(targetPath)
	absWorkspace, _ := filepath.Abs(WORKSPACE_DIR)
	if len(absTarget) < len(absWorkspace) || absTarget[:len(absWorkspace)] != absWorkspace {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: "[安全拦截] 禁止写入沙盒之外"})
		return
	}

	// 确保目标目录存在
	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: fmt.Sprintf("创建目录失败: %s", err.Error())})
		return
	}

	// 写入文件
	if err := os.WriteFile(targetPath, []byte(req.Content), 0644); err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: err.Error()})
		return
	}

	json.NewEncoder(w).Encode(ExecuteResponse{
		Status: "success",
		Output: fmt.Sprintf("文件已写入: %s (%d 字节)", req.Filename, len(req.Content)),
	})
}

// ─── 👁️ 武器 2: 深网穿透器 ─────────────────────
// 读取 URL 全文，HTML→纯文本

func handleReadWeb(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"status":"error","error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req ReadWebRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: err.Error()})
		return
	}

	if req.Url == "" {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: "url 不能为空"})
		return
	}

	// HTTP GET 请求
	resp, err := http.Get(req.Url)
	if err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: fmt.Sprintf("请求失败: %s", err.Error())})
		return
	}
	defer resp.Body.Close()

	// 读取全部内容
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: fmt.Sprintf("读取响应失败: %s", err.Error())})
		return
	}

	// 简单 HTML→纯文本：去掉标签，保留文本
	html := string(body)
	text := stripHTML(html)

	// 限制返回长度（防止 token 爆炸）
	const maxLen = 8000
	if len(text) > maxLen {
		text = text[:maxLen] + "\n\n[...内容已截断，仅显示前8000字符]"
	}

	json.NewEncoder(w).Encode(ExecuteResponse{
		Status: "success",
		Output: text,
	})
}

// stripHTML 简单去除 HTML 标签，提取纯文本
func stripHTML(html string) string {
	var result []byte
	inTag := false
	inScript := false
	inStyle := false

	// 先转义常见实体
	htmlStr := html
	htmlStr = strings.ReplaceAll(htmlStr, "&nbsp;", " ")
	htmlStr = strings.ReplaceAll(htmlStr, "&", "&")
	htmlStr = strings.ReplaceAll(htmlStr, "<", "<")
	htmlStr = strings.ReplaceAll(htmlStr, ">", ">")
	htmlStr = strings.ReplaceAll(htmlStr, "&#34;", "\"")
	htmlStr = strings.ReplaceAll(htmlStr, "'", "'")

	for i := 0; i < len(htmlStr); i++ {
		c := htmlStr[i]

		if c == '<' {
			inTag = true
			// 检测 script/style 标签
			if i+6 < len(htmlStr) && (string(htmlStr[i+1:i+7]) == "script" || string(htmlStr[i+1:i+7]) == "SCRIPT") {
				inScript = true
			}
			if i+5 < len(htmlStr) && (string(htmlStr[i+1:i+6]) == "style" || string(htmlStr[i+1:i+6]) == "STYLE") {
				inStyle = true
			}
			continue
		}

		if c == '>' {
			inTag = false
			// 检测 script/style 结束标签
			if inScript && i >= 8 {
				lower := htmlStr[i-7 : i]
				if lower == "/script" || lower == "/SCRIPT" {
					inScript = false
				}
			}
			if inStyle && i >= 6 {
				lower := htmlStr[i-5 : i]
				if lower == "/style" || lower == "/STYLE" {
					inStyle = false
				}
			}
			continue
		}

		if !inTag && !inScript && !inStyle {
			// 合并连续空白
			if c == ' ' || c == '\n' || c == '\t' || c == '\r' {
				if len(result) > 0 && result[len(result)-1] != ' ' {
					result = append(result, ' ')
				}
			} else {
				result = append(result, c)
			}
		}
	}

	return strings.TrimSpace(string(result))
}

// ─── 🔔 武器 3: 赛博传呼机 ─────────────────────
// 系统桌面通知（Windows 用 powershell，Mac 用 osascript）

func handleNotify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"status":"error","error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req NotifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(ExecuteResponse{Status: "error", Error: err.Error()})
		return
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		// 使用 PowerShell 弹出原生 Toast 通知
		psScript := fmt.Sprintf(
			`[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; `+
				`$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); `+
				`$textNodes = $template.GetElementsByTagName("text"); `+
				`$textNodes.Item(0).AppendChild($template.CreateTextNode("%s")) > $null; `+
				`$textNodes.Item(1).AppendChild($template.CreateTextNode("%s")) > $null; `+
				`$toast = [Windows.UI.Notifications.ToastNotification]::new($template); `+
				`[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier().Show($toast);`,
			escapePSString(req.Title), escapePSString(req.Message))
		cmd = exec.Command("powershell", "-Command", psScript)
	case "darwin":
		cmd = exec.Command("osascript", "-e", fmt.Sprintf(`display notification "%s" with title "%s"`, req.Message, req.Title))
	default:
		// Linux: 尝试 notify-send
		cmd = exec.Command("notify-send", req.Title, req.Message)
	}

	_ = cmd.Run()

	json.NewEncoder(w).Encode(ExecuteResponse{
		Status: "success",
		Output: fmt.Sprintf("通知已发送: [%s] %s", req.Title, req.Message),
	})
}

// escapePSString 转义 PowerShell 字符串中的特殊字符
func escapePSString(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, `'`, `''`)
	return s
}

// ─── 工作区状态 API ────────────────────────────

func handleWorkspaceStatus(w http.ResponseWriter, r *http.Request) {
	workspace := r.URL.Query().Get("workspace")
	target := resolveWorkspace(workspace)
	absDir, _ := filepath.Abs(target)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "active",
		"path":    absDir,
		"message": fmt.Sprintf("沙盒工作区已挂载: %s", absDir),
	})
}

// ─── 打开工作区 API ────────────────────────────

func handleOpenWorkspace(w http.ResponseWriter, r *http.Request) {
	workspace := r.URL.Query().Get("workspace")
	target := resolveWorkspace(workspace)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", target)
	case "darwin":
		cmd = exec.Command("open", target)
	default:
		cmd = exec.Command("xdg-open", target)
	}

	_ = cmd.Start()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ExecuteResponse{
		Status: "success",
		Output: fmt.Sprintf("已打开工作区: %s", target),
	})
}

// ─── HTTP 处理器 ───────────────────────────────

func handleExecute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf(`{"status":"error","error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	result := executeInstruction(req.Instruction, req.Workspace)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ─── 启动入口 ──────────────────────────────────

func main() {
	http.HandleFunc("/execute", corsMiddleware(handleExecute))
	http.HandleFunc("/workspace-status", corsMiddleware(handleWorkspaceStatus))
	http.HandleFunc("/open-workspace", corsMiddleware(handleOpenWorkspace))
	http.HandleFunc("/api/tools/write_file", corsMiddleware(handleWriteFile))
	http.HandleFunc("/api/tools/read_web", corsMiddleware(handleReadWeb))
	http.HandleFunc("/api/tools/notify", corsMiddleware(handleNotify))

	ascii := `
    ╔══════════════════════════════════════╗
    ║     ⎔ Niko-Bridge: Ghost Node v3    ║
    ║     🔒 Sandbox  |  🗡️ 3 New Weapons ║
    ╚══════════════════════════════════════╝
	`

	fmt.Println(ascii)
	log.Printf("[Niko-Bridge] Ghost Node v3 is listening on 127.0.0.1:11451 ...")

	if err := http.ListenAndServe("127.0.0.1:11451", nil); err != nil {
		log.Fatalf("[Niko-Bridge] Failed to start: %v", err)
	}
}
