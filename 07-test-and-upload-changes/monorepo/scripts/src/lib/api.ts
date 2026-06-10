export type ApiCheck = {
  name: string;
  method?: string;
  path: string;
  token?: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
};

export async function apiFetch(
  apiBaseUrl: string,
  path: string,
  options: RequestInit = {},
) {
  return fetch(`${apiBaseUrl}${path}`, options);
}

export async function runApiCheck(apiBaseUrl: string, check: ApiCheck) {
  const headers = new Headers({
    ...(check.headers ?? {}),
    ...(check.token ? { Authorization: check.token } : {}),
  });

  const response = await apiFetch(apiBaseUrl, check.path, {
    method: check.method ?? "GET",
    headers,
    body: check.body ? JSON.stringify(check.body) : undefined,
  });

  const passed = response.status === check.expectedStatus;

  return {
    ...check,
    actualStatus: response.status,
    passed,
  };
}
