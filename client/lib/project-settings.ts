import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheListedReadingLimits, captureSettings, createSettingsRepository, SettingsSession } from "./project-settings-repository";
export { settingsKey, SettingsSession } from "./project-settings-repository";

export const projectSettings = createSettingsRepository(AsyncStorage);
export const captureProjectSettings = (session: SettingsSession, online: boolean) =>
  captureSettings(projectSettings, session, online);
export const cacheProjectReadingLimits = (session: SettingsSession, project: Record<string, any>) =>
  cacheListedReadingLimits(AsyncStorage, session, project);
