export type ApiCheck = {
  name: string;
  path: string;
  method?: string;
  token?: string;
  expectedStatus: number;
};

export async function runApiCheck(apiBaseUrl: string, check: ApiCheck) {
  const headers: Record<string, string> = {};

  if (check.token) {
    headers.Authorization = check.token;
  }

  const response = await fetch(`${apiBaseUrl}${check.path}`, {
    method: check.method ?? "GET",
    headers,
  });

  const passed = response.status === check.expectedStatus;

  return {
    ...check,
    actualStatus: response.status,
    passed,
  };
}
