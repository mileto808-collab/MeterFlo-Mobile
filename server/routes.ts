import type { Express } from "express";
import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";
import { createProxyMiddleware } from "http-proxy-middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Create WebSocket proxy for Metro bundler
  const wsProxy = createProxyMiddleware({
    target: "http://127.0.0.1:8081",
    changeOrigin: true,
    ws: true,
    logger: console,
  });

  // Handle WebSocket upgrade requests for Metro
  httpServer.on("upgrade", (req, socket, head) => {
    const path = req.url || "";
    // Proxy WebSocket connections for Metro endpoints
    if (
      path.startsWith("/hot") ||
      path.startsWith("/logs") ||
      path.startsWith("/message") ||
      path.startsWith("/debugger-proxy") ||
      path.startsWith("/inspector") ||
      path.startsWith("/symbolicate")
    ) {
      wsProxy.upgrade?.(req, socket as Socket, head);
    }
  });

  return httpServer;
}
