/**
 * NikoAI — LLM API 客户端
 * 无状态，只负责发 HTTP 请求和解包。
 * 支持 OpenAI 兼容接口的 Chat Completions 与 Models 拉取。
 */

/**
 * 去除 URL 末尾多余的斜杠
 */
function sanitizeUrl(url) {
  return url.replace(/\/+$/, '');
}

/**
 * 调用大模型 API
 * @param {Object} opts
 * @param {Object} opts.provider - Provider 对象（含 url, apiKey）
 * @param {string} opts.model - 模型名称
 * @param {Array} opts.messages - 对话消息数组
 * @param {Array} [opts.tools] - OpenAI 格式的 tools 数组
 * @returns {Promise<Object>} choices[0].message
 */
export async function callLLM({ provider, model, messages, tools, params }) {
  const baseUrl = sanitizeUrl(provider.url);
  const body = {
    model,
    messages,
    ...params  // 透传 max_tokens, temperature 等超参数
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LLM API ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.choices[0].message;
}

/**
 * 探活并拉取模型列表
 * @param {string} url - API 基础地址
 * @param {string} apiKey - API 密钥
 * @returns {Promise<string[]>} 模型 ID 数组
 */
export async function fetchProviderModels(url, apiKey) {
  const baseUrl = sanitizeUrl(url);
  const response = await fetch(baseUrl + '/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`探活失败 ${response.status}: ${errText}`);
  }

  const json = await response.json();
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('返回格式异常：缺少 data 数组');
  }

  return json.data.map(item => item.id);
}
