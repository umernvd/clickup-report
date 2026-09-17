import axios from 'axios';
import { sleep } from '../utils/sleep.js';

export function createClickUpClient(token) {
  const client = axios.create({
    baseURL: 'https://api.clickup.com/api/v2',
    headers: {
      Authorization: token,
    },
    timeout: 30000,
  });

  // Safety guard: block any non-GET requests (this app is read-only)
  client.interceptors.request.use((config) => {
    const method = config.method?.toUpperCase();
    if (method && method !== 'GET' && method !== 'HEAD') {
      throw new Error(
        `BLOCKED: ${method} request to ${config.url} is not allowed. This application is read-only.`
      );
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response && error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;

        error.config._retryCount = error.config._retryCount || 0;
        error.config._retryCount += 1;

        if (error.config._retryCount > 5) {
          throw new Error('ClickUp rate limit retry limit exceeded after 5 attempts.');
        }

        console.log(`ClickUp rate limit hit. Waiting ${waitSeconds} seconds before retry.`);
        await sleep(waitSeconds * 1000);
        return axios(error.config);
      }

      if (
        error.response &&
        [500, 502, 503, 504].includes(error.response.status)
      ) {
        error.config._serverRetryCount = error.config._serverRetryCount || 0;
        error.config._serverRetryCount += 1;

        if (error.config._serverRetryCount > 3) {
          throw error;
        }

        const waitMs = Math.pow(2, error.config._serverRetryCount - 1) * 1000;
        console.log(
          `Server error ${error.response.status}. Retry ${error.config._serverRetryCount}/3 after ${waitMs / 1000}s.`
        );
        await sleep(waitMs);
        return axios(error.config);
      }

      throw error;
    }
  );

  return client;
}
