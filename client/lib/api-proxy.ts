import { getApiUrl } from "@/lib/query-client";

interface ProxyRequest {
  serverUrl: string;
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function proxyRequest<T = any>(options: ProxyRequest): Promise<T> {
  const baseUrl = getApiUrl();
  
  const response = await fetch(`${baseUrl}/api/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  
  return response.text() as unknown as T;
}

export async function clearProxySession(serverUrl: string): Promise<void> {
  const baseUrl = getApiUrl();
  
  await fetch(`${baseUrl}/api/proxy/session`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverUrl }),
  });
}
