import axios from "axios";
import axiosRetry from "axios-retry";

export function createClickUpClient(token) {
  const client = axios.create({
    baseURL: "https://api.clickup.com/api/v2",
    headers: {
      Authorization: token,
    },
    timeout: 30000,
  });

  client.interceptors.request.use((config) => {
    const method = config.method?.toUpperCase();
    if (method && method !== "GET" && method !== "HEAD") {
      throw new Error(`Read-only: ${method} not allowed`);
    }
    return config;
  });

  axiosRetry(client, {
    retries: 5,
    retryCondition: (error) => {
      if (error.response?.status === 429) return true;
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        [500, 502, 503, 504].includes(error.response?.status)
      );
    },
    retryDelay: (retryCount, error) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.["retry-after"];
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 0;
        if (!isNaN(seconds) && seconds > 0 && seconds <= 60) {
          console.log(`Rate limited, waiting ${seconds}s`);
          return seconds * 1000;
        }
      }
      const delay = axiosRetry.exponentialDelay(retryCount);
      console.log(`Retry ${retryCount}/5 after ${delay / 1000}s`);
      return delay;
    },
  });

  return client;
}
