/**
 * NikoAI — Web 工具实现（物理义体）
 * 纯异步函数，对接外部 API。
 * 当前使用 mock 数据，未来替换为真实 Serper API。
 */

/**
 * 执行全网搜索
 * @param {string} query - 搜索关键词
 * @returns {Promise<string>}
 */
export async function executeWebSearch(query) {
  // TODO: 替换为真实 Serper / Google Search API
  return `[模拟搜索结果] 关于 "${query}" 的信息：今天天气晴朗，气温 25 度，适合敲代码。`;
}
