import axios from 'axios';

/**
 * 带重试机制的请求
 * @param {Function} requestFn - 返回 Promise 的请求函数
 * @param {Object} options - 配置项
 * @param {number} options.maxRetries - 最大重试次数，默认 3
 * @param {number} options.delay - 重试间隔（毫秒），默认 1000
 * @param {Function} options.onRetry - 重试时的回调
 * @returns {Promise}
 */
export const withRetry = async (requestFn, options = {}) => {
  const { maxRetries = 3, delay = 1000, onRetry } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // 如果是 404 或 400 等客户端错误，不重试
      if (error.response && error.response.status < 500) {
        throw error;
      }
      
      // 如果是网络错误或 5xx 服务端错误，重试
      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt, error);
        }
        console.log(`🔄 请求失败，${delay}ms 后重试 (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
};

/**
 * 带重试的 axios get 请求
 */
export const axiosGetWithRetry = async (url, config = {}, options = {}) => {
  return withRetry(
    () => axios.get(url, config),
    options
  );
};