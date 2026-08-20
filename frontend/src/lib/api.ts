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

/**
 * Safely add/replace the Authorization header without replacing
 * AxiosHeaders with a plain object.
 */
function setAuthHeader(
  config: AxiosRequestConfig,
  token: string,
): void {
  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("Authorization", `Bearer ${token}`);
    return;
  }

  const headers = new AxiosHeaders();

  if (config.headers) {
    Object.entries(config.headers as Record<string, unknown>).forEach(
      ([key, value]) => {
        if (value !== undefined && value !== null) {
          headers.set(key, String(value));
        }
      },
    );
  }

  headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;
}

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

/**
 * Attach the current access token to outgoing browser requests.
 */
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");

      if (token) {
        setAuthHeader(config, token);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Refresh an expired access token once, then retry the original request.
 */
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
        setAuthHeader(original, token);
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

      setAuthHeader(original, data.access_token);

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