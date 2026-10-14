import { readingLimits } from "./reading-precision";

export interface SettingsSession {
  serverUrl: string;
  userId: string;
  projectId: number;
}

export class SettingsUnavailableError extends Error {}

/** Connectivity alone does not imply that capture can reach its server. */
export function isCaptureOnline(connected: boolean, offlineSession: boolean, source?: string): boolean {
  return connected && !offlineSession && source !== "cache";
}

export async function captureSettings(
  repository: (session: SettingsSession, online: boolean) => Promise<Record<string, any>>,
  session: SettingsSession, online: boolean,
): Promise<Record<string, any>> {
  if (!online) return { ...await repository(session, false), readingSettingsSource: "cache" };
  try {
    return { ...await repository(session, true), readingSettingsSource: "server" };
  } catch (error) {
    // Unavailability is not an authorization or policy error. Uploads never use this fallback.
    if (!(error instanceof SettingsUnavailableError)) throw error;
    return { ...await repository(session, false), readingSettingsSource: "cache" };
  }
}

export function settingsKey(session: SettingsSession): string {
  return `meterflo_project_settings:${JSON.stringify([
    session.serverUrl.replace(/\/+$/, ""), session.userId, session.projectId,
  ])}`;
}

export async function cacheListedReadingLimits(storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
}, session: SettingsSession, project: Record<string, any>): Promise<void> {
  if (!("systemReadingDecimalPlaces" in project) && !("moduleReadingDecimalPlaces" in project)) return;
  const key = settingsKey(session);
  const saved = await storage.getItem(key);
  const cached = saved ? JSON.parse(saved) : {};
  await storage.setItem(key, JSON.stringify({ ...cached, ...readingLimits(project) }));
}

export function createSettingsRepository(storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
}, request: typeof fetch = fetch) {
  const requests = new Map<string, Promise<Record<string, any>>>();
  return async (session: SettingsSession, online: boolean): Promise<Record<string, any>> => {
    const key = settingsKey(session);
    if (!online) {
      const cached = await storage.getItem(key);
      const data = cached ? JSON.parse(cached) : {};
      return { ...data, ...readingLimits(data) };
    }
    const pending = requests.get(key);
    if (pending) return pending;
    const load = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let response: Response;
      try {
        response = await request(`${session.serverUrl.replace(/\/+$/, "")}/api/projects/${session.projectId}`, {
          credentials: "include", signal: controller.signal,
          headers: { "X-Requested-With": "XMLHttpRequest", Origin: session.serverUrl, Referer: `${session.serverUrl}/` },
        });
      } catch {
        throw new SettingsUnavailableError("The server is unreachable. Cached project settings are available for offline capture.");
      } finally {
        clearTimeout(timeout);
      }
      if ([502, 503, 504].includes(response.status)) throw new SettingsUnavailableError("Project settings are temporarily unavailable.");
      if (!response.ok) throw new Error(`Unable to refresh project settings (${response.status}). Your readings remain saved.`);
      const data = await response.json();
      const settings = { ...data, ...readingLimits(data) };
      await storage.setItem(key, JSON.stringify(settings));
      return settings;
    })();
    requests.set(key, load);
    try {
      return await load;
    } finally {
      if (requests.get(key) === load) requests.delete(key);
    }
  };
}
