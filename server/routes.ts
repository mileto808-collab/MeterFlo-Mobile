import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

interface ProxyRequestBody {
  serverUrl: string;
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

const sessionCookies = new Map<string, string>();

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/proxy", async (req: Request, res: Response) => {
    try {
      const { serverUrl, method = "GET", path, body, headers = {} }: ProxyRequestBody = req.body;
      
      if (!serverUrl || !path) {
        return res.status(400).json({ error: "serverUrl and path are required" });
      }

      const url = `${serverUrl}${path}`;
      const sessionKey = serverUrl;
      const existingCookie = sessionCookies.get(sessionKey);
      
      const fetchHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers,
      };
      
      if (existingCookie) {
        fetchHeaders["Cookie"] = existingCookie;
      }

      const fetchOptions: RequestInit = {
        method,
        headers: fetchHeaders,
        credentials: "include",
      };

      if (body && method !== "GET") {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      
      const setCookieHeader = response.headers.get("set-cookie");
      if (setCookieHeader) {
        sessionCookies.set(sessionKey, setCookieHeader.split(";")[0]);
      }

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).send(errorText);
      }

      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return res.json(data);
      } else {
        const text = await response.text();
        return res.send(text);
      }
    } catch (error) {
      console.error("Proxy error:", error);
      const message = error instanceof Error ? error.message : "Proxy request failed";
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/proxy/form", async (req: Request, res: Response) => {
    try {
      const serverUrl = req.headers["x-server-url"] as string;
      const path = req.headers["x-path"] as string;
      
      if (!serverUrl || !path) {
        return res.status(400).json({ error: "x-server-url and x-path headers are required" });
      }

      const url = `${serverUrl}${path}`;
      const sessionKey = serverUrl;
      const existingCookie = sessionCookies.get(sessionKey);
      
      const fetchHeaders: Record<string, string> = {};
      
      if (existingCookie) {
        fetchHeaders["Cookie"] = existingCookie;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: fetchHeaders,
        body: req.body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).send(errorText);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return res.json(data);
      } else {
        const text = await response.text();
        return res.send(text);
      }
    } catch (error) {
      console.error("Proxy form error:", error);
      const message = error instanceof Error ? error.message : "Proxy request failed";
      return res.status(500).json({ error: message });
    }
  });

  app.delete("/api/proxy/session", (req: Request, res: Response) => {
    const serverUrl = req.body.serverUrl;
    if (serverUrl) {
      sessionCookies.delete(serverUrl);
    }
    res.json({ success: true });
  });

  const httpServer = createServer(app);

  return httpServer;
}
