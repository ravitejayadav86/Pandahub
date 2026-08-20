import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

export const BASE_URL = "/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

type RetryConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  const queue = [...failedQueue];
  failedQueue = [];

  for (const item of queue) {
    if (error || !token) {
      item.reject(error ?? new Error("Token refresh failed."));
    } else {
      item.resolve(token);
    }
  }
}

function applyAuthorization(
  config: AxiosRequestConfig,
  token: string,
): AxiosRequestConfig {
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : AxiosHeaders.from(config.headers);

  headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;

  return config;
}

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");

      if (token) {
        const headers =
          config.headers instanceof AxiosHeaders
            ? config.headers
            : AxiosHeaders.from(config.headers);

        headers.set("Authorization", `Bearer ${token}`);
        config.headers = headers;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const original = (error.config || {}) as RetryConfig;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        applyAuthorization(original, token);
        return api(original);
      });
    }

    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;

    if (!refreshToken) {
      return Promise.reject(error);
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      if (!data?.access_token || !data?.refresh_token) {
        throw new Error("Refresh endpoint returned invalid tokens.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      processQueue(null, data.access_token);

      applyAuthorization(original, data.access_token);

      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);

      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.assign("/login");
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;