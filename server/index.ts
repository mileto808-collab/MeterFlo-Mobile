import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn } from "child_process";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "100mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "100mb" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response): boolean {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
  return true;
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function getPublicHost(req: Request): string {
  const forwardedHost = req.header("x-forwarded-host");
  return forwardedHost || req.get("host") || process.env.REPLIT_DEV_DOMAIN || "localhost:5000";
}

function rewriteUrl(url: string, publicHost: string): string {
  if (!url) return url;
  
  const localhostPatterns = [
    /^https?:\/\/127\.0\.0\.1(:\d+)?/,
    /^https?:\/\/localhost(:\d+)?/,
    /^wss?:\/\/127\.0\.0\.1(:\d+)?/,
    /^wss?:\/\/localhost(:\d+)?/,
  ];
  
  for (const pattern of localhostPatterns) {
    if (pattern.test(url)) {
      return url
        .replace(/^http:/, "https:")
        .replace(/^ws:/, "wss:")
        .replace(/127\.0\.0\.1(:\d+)?/, publicHost)
        .replace(/localhost(:\d+)?/, publicHost);
    }
  }
  
  return url;
}

function rewriteManifestUrls(manifest: any, publicHost: string): any {
  const publicBaseUrl = `https://${publicHost}`;
  
  // Rewrite all URL fields
  if (manifest.launchAsset && manifest.launchAsset.url) {
    manifest.launchAsset.url = rewriteUrl(manifest.launchAsset.url, publicHost);
  }
  
  if (manifest.bundleUrl) {
    manifest.bundleUrl = rewriteUrl(manifest.bundleUrl, publicHost);
  }
  
  if (manifest.assetUrlOverride) {
    manifest.assetUrlOverride = rewriteUrl(manifest.assetUrlOverride, publicHost);
  }
  
  // Always set hostUri to public host (remove port for cleaner URL)
  manifest.hostUri = publicHost;
  
  // Always set debuggerHost to public host
  manifest.debuggerHost = publicHost;
  
  if (manifest.extra) {
    if (manifest.extra.expoGo) {
      manifest.extra.expoGo.debuggerHost = publicHost;
      manifest.extra.expoGo.mainModuleName = "client/index";
      if (manifest.extra.expoGo.packagerOpts) {
        manifest.extra.expoGo.packagerOpts.dev = true;
      }
      if (manifest.extra.expoGo.developer) {
        manifest.extra.expoGo.developer.tool = "expo-cli";
        if (manifest.extra.expoGo.developer.projectRoot) {
          // Keep project root as is
        }
      }
    }
    if (manifest.extra.expoClient) {
      manifest.extra.expoClient.hostUri = publicHost;
      if (manifest.extra.expoClient.iconUrl) {
        manifest.extra.expoClient.iconUrl = rewriteUrl(manifest.extra.expoClient.iconUrl, publicHost);
        if (!manifest.extra.expoClient.iconUrl.startsWith("https://")) {
          manifest.extra.expoClient.iconUrl = `${publicBaseUrl}/assets/images/icon.png`;
        }
      }
    }
  }
  
  if (manifest.assets && Array.isArray(manifest.assets)) {
    manifest.assets = manifest.assets.map((asset: any) => {
      if (asset.url) {
        asset.url = rewriteUrl(asset.url, publicHost);
      }
      return asset;
    });
  }
  
  // Deep replace any remaining localhost references
  let manifestStr = JSON.stringify(manifest);
  manifestStr = manifestStr.replace(/127\.0\.0\.1(:\d+)?/g, publicHost);
  manifestStr = manifestStr.replace(/localhost(:\d+)?/g, publicHost);
  
  try {
    manifest = JSON.parse(manifestStr);
  } catch (e) {
    log(`Warning: Failed to parse manifest after string replacement`);
  }
  
  // Final verification
  const finalStr = JSON.stringify(manifest);
  if (finalStr.includes("127.0.0.1") || finalStr.includes("localhost")) {
    log(`Warning: Manifest still contains localhost references after rewriting`);
  }
  
  return manifest;
}

async function fetchAndRewriteMetroManifest(platform: string, publicHost: string): Promise<string | null> {
  try {
    const response = await fetch(`http://127.0.0.1:8081/`, {
      headers: {
        "expo-platform": platform,
      },
    });
    
    if (!response.ok) {
      log(`Metro manifest fetch failed: ${response.status}`);
      return null;
    }
    
    const manifest = await response.json();
    const rewrittenManifest = rewriteManifestUrls(manifest, publicHost);
    return JSON.stringify(rewrittenManifest);
  } catch (error) {
    log(`Error fetching Metro manifest: ${error}`);
    return null;
  }
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  const metroProxy = createProxyMiddleware({
    target: "http://127.0.0.1:8081",
    changeOrigin: true,
    ws: true,
    logger: console,
    on: {
      error: (err: Error, req: any, res: any) => {
        console.error("Metro proxy error:", err.message);
        if (res && 'writeHead' in res) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Metro bundler not available" }));
        }
      },
    },
  });

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      const served = serveExpoManifest(platform, res);
      if (!served) {
        log(`No static manifest for ${platform}, fetching from Metro and rewriting URLs`);
        const publicHost = getPublicHost(req);
        const rewrittenManifest = await fetchAndRewriteMetroManifest(platform, publicHost);
        
        if (rewrittenManifest) {
          res.setHeader("expo-protocol-version", "0");
          res.setHeader("expo-sfv-version", "0");
          res.setHeader("cache-control", "private, max-age=0");
          res.setHeader("content-type", "application/json");
          res.send(rewrittenManifest);
          return;
        }
        
        log(`Failed to fetch manifest from Metro, falling back to proxy`);
        if (req.path === "/manifest") {
          req.url = "/";
        }
        return metroProxy(req, res, next);
      }
      return;
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  // Proxy bundle requests and other Metro-specific paths
  app.use((req, res, next) => {
    if (req.path.endsWith('.bundle') || req.path.endsWith('.map')) {
      return metroProxy(req, res, next);
    }
    next();
  });
  app.use("/symbolicate", metroProxy);
  app.use("/logs", metroProxy);
  app.use("/hot", metroProxy);
  app.use("/status", metroProxy);
  app.use("/message", metroProxy);

  log("Expo routing: Checking expo-platform header on / and /manifest");
  log("Metro proxy: Forwarding bundle and manifest requests to port 8081");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({ message });

    throw err;
  });
}

function startExpoTunnel(): void {
  if (process.env.SPAWN_EXPO_TUNNEL !== "true") {
    return;
  }
  
  log("TunnelManager: Starting Expo with --tunnel mode for external device access");
  
  const expoProcess = spawn("npx", ["expo", "start", "--tunnel", "--non-interactive"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: `${process.env.REPLIT_DEV_DOMAIN}:5000`,
    },
    detached: false,
  });
  
  expoProcess.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();
    if (output.includes("exp://") || output.includes("Tunnel")) {
      log(`TunnelManager: ${output.trim()}`);
    }
  });
  
  expoProcess.stderr?.on("data", (data: Buffer) => {
    const output = data.toString();
    if (!output.includes("deprecated") && !output.includes("warning")) {
      log(`TunnelManager stderr: ${output.trim()}`);
    }
  });
  
  expoProcess.on("error", (err) => {
    log(`TunnelManager: Expo process error: ${err.message}`);
  });
  
  expoProcess.on("exit", (code) => {
    log(`TunnelManager: Expo process exited with code ${code}`);
    if (code !== 0 && process.env.SPAWN_EXPO_TUNNEL === "true") {
      log("TunnelManager: Restarting Expo tunnel in 5 seconds...");
      setTimeout(() => startExpoTunnel(), 5000);
    }
  });
  
  log("TunnelManager: Expo tunnel process spawned, claiming port 8081");
}

(async () => {
  // Start Expo tunnel FIRST to claim port 8081 before workflow's expo:dev
  startExpoTunnel();
  
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
