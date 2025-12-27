import type { Express } from "express";
import { createServer, type Server } from "node:http";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/mobile/auth/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }

    if (username === "demo" && password === "demo123") {
      return res.json({
        user: {
          id: "user-1",
          username: "demo",
          name: "Demo User",
          role: "Field Technician",
        },
        token: "demo-token-" + Date.now(),
      });
    }

    return res.status(401).send("Invalid username or password");
  });

  app.get("/api/mobile/work-orders", (req, res) => {
    res.json([]);
  });

  const httpServer = createServer(app);

  return httpServer;
}
