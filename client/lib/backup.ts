import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import JSZip from "jszip";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { decode as base64Decode } from "base-64";

const CSV_HEADERS = [
  "customerWoId",
  "id",
  "status",
  "serviceAddress",
  "city",
  "state",
  "zip",
  "customerId",
  "customerName",
  "customerPhone",
  "customerEmail",
  "oldSystemId",
  "oldSystemReading",
  "oldSystemType",
  "oldGps",
  "newSystemId",
  "newSystemReading",
  "newSystemType",
  "newGps",
  "serviceType",
  "route",
  "zone",
  "scheduledDate",
  "assignedUserDisplayName",
  "assignedUserUsername",
  "assignedGroupName",
  "troubleCode",
  "troubleNote",
  "notes",
  "signatureName",
  "completedAt",
  "completedByUsername",
  "createdAt",
  "updatedAt",
  "syncPending",
];

function escapeCSV(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function workOrderToCSVRow(wo: WorkOrder): string {
  return CSV_HEADERS.map((header) => {
    const value = wo[header as keyof WorkOrder];
    return escapeCSV(value as string | number | boolean | undefined);
  }).join(",");
}

function generateCSV(workOrders: WorkOrder[]): string {
  const headerRow = CSV_HEADERS.join(",");
  const dataRows = workOrders.map(workOrderToCSVRow);
  return [headerRow, ...dataRows].join("\n");
}

function base64ToUint8Array(base64String: string): Uint8Array {
  const base64Data = base64String.includes(",") 
    ? base64String.split(",")[1] 
    : base64String;
  
  const binaryString = base64Decode(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface BackupProgress {
  stage: "preparing" | "photos" | "csv" | "zipping" | "saving" | "complete";
  current: number;
  total: number;
  message: string;
}

export async function createBackupZip(
  workOrders: WorkOrder[],
  onProgress?: (progress: BackupProgress) => void
): Promise<string> {
  const zip = new JSZip();
  const projectFilesFolder = zip.folder("MeterFlo")!.folder("Project Files")!;
  
  onProgress?.({
    stage: "csv",
    current: 0,
    total: 1,
    message: "Generating work orders CSV...",
  });

  const csvContent = generateCSV(workOrders);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  projectFilesFolder.file(`work_orders_backup_${timestamp}.csv`, csvContent);

  onProgress?.({
    stage: "csv",
    current: 1,
    total: 1,
    message: "CSV file created",
  });

  const workOrdersWithPhotos = workOrders.filter(
    (wo) =>
      (wo.beforePhotos && wo.beforePhotos.length > 0) ||
      (wo.afterPhotos && wo.afterPhotos.length > 0) ||
      (wo.troublePhotos && wo.troublePhotos.length > 0)
  );

  let totalPhotos = 0;
  workOrdersWithPhotos.forEach((wo) => {
    totalPhotos += (wo.beforePhotos?.length || 0) + (wo.afterPhotos?.length || 0) + (wo.troublePhotos?.length || 0);
  });

  let processedPhotos = 0;

  for (const wo of workOrdersWithPhotos) {
    const woId = wo.customerWoId || String(wo.id);
    const woFolder = projectFilesFolder.folder(woId);

    if (!woFolder) continue;

    const addPhotos = async (
      photos: { base64: string; filename: string }[] | undefined,
      prefix: string
    ) => {
      if (!photos) return;
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          const photoData = base64ToUint8Array(photo.base64);
          const filename = photo.filename || `${woId}-${prefix}-${i + 1}.jpg`;
          woFolder.file(filename, photoData, { binary: true });
          processedPhotos++;
          onProgress?.({
            stage: "photos",
            current: processedPhotos,
            total: totalPhotos,
            message: `Processing photo ${processedPhotos} of ${totalPhotos}...`,
          });
        } catch (err) {
          console.warn(`[Backup] Failed to process photo ${photo.filename}:`, err);
        }
      }
    };

    await addPhotos(wo.beforePhotos, "before");
    await addPhotos(wo.afterPhotos, "after");
    await addPhotos(wo.troublePhotos, "trouble");
  }

  onProgress?.({
    stage: "zipping",
    current: 0,
    total: 1,
    message: "Creating zip archive...",
  });

  const zipBlob = await zip.generateAsync({ 
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  onProgress?.({
    stage: "saving",
    current: 0,
    total: 1,
    message: "Saving backup to device...",
  });

  const backupFilename = `MeterFlo_Backup_${timestamp}.zip`;
  
  if (Platform.OS === "web") {
    const link = document.createElement("a");
    link.href = `data:application/zip;base64,${zipBlob}`;
    link.download = backupFilename;
    link.click();
    
    onProgress?.({
      stage: "complete",
      current: 1,
      total: 1,
      message: "Backup downloaded",
    });
    
    return backupFilename;
  }

  const documentDir = FileSystem.documentDirectory;
  if (!documentDir) {
    throw new Error("Could not access device documents directory");
  }

  const meterFloDir = `${documentDir}MeterFlo/`;
  const projectFilesDir = `${meterFloDir}Project Files/`;
  
  await FileSystem.makeDirectoryAsync(meterFloDir, { intermediates: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(projectFilesDir, { intermediates: true }).catch(() => {});

  const backupPath = `${projectFilesDir}${backupFilename}`;
  
  await FileSystem.writeAsStringAsync(backupPath, zipBlob, {
    encoding: FileSystem.EncodingType.Base64,
  });

  onProgress?.({
    stage: "complete",
    current: 1,
    total: 1,
    message: `Backup saved to MeterFlo/Project Files/${backupFilename}`,
  });

  return backupPath;
}

export async function shareBackup(backupPath: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(backupPath, {
      mimeType: "application/zip",
      dialogTitle: "Share MeterFlo Backup",
    });
  }
}

export interface BackupFile {
  name: string;
  path: string;
  size: number;
  modifiedTime: number;
}

export async function listBackupFiles(): Promise<BackupFile[]> {
  if (Platform.OS === "web") {
    return [];
  }
  
  const documentDir = FileSystem.documentDirectory;
  if (!documentDir) {
    return [];
  }
  
  const projectFilesDir = `${documentDir}MeterFlo/Project Files/`;
  
  try {
    await FileSystem.makeDirectoryAsync(projectFilesDir, { intermediates: true }).catch(() => {});
    
    const files = await FileSystem.readDirectoryAsync(projectFilesDir);
    const backupFiles: BackupFile[] = [];
    
    for (const file of files) {
      if (file.endsWith(".zip")) {
        const filePath = `${projectFilesDir}${file}`;
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && !fileInfo.isDirectory) {
            backupFiles.push({
              name: file,
              path: filePath,
              size: fileInfo.size || 0,
              modifiedTime: fileInfo.modificationTime || Date.now(),
            });
          }
        } catch (err) {
          console.warn(`[Backup] Failed to get info for ${file}:`, err);
        }
      }
    }
    
    backupFiles.sort((a, b) => b.modifiedTime - a.modifiedTime);
    return backupFiles;
  } catch (err) {
    console.error("[Backup] Error listing backup files:", err);
    return [];
  }
}

export async function deleteBackupFile(filePath: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }
  
  try {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
    return true;
  } catch (err) {
    console.error("[Backup] Error deleting backup file:", err);
    return false;
  }
}

export async function getBackupBase64(filePath: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }
  
  try {
    const base64Content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64Content;
  } catch (err) {
    console.error("[Backup] Error reading backup file:", err);
    return null;
  }
}

export async function saveBackupToFolder(backupPath: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }
  
  try {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    
    if (!permissions.granted) {
      return null;
    }
    
    const directoryUri = permissions.directoryUri;
    
    const base64Content = await FileSystem.readAsStringAsync(backupPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const filename = backupPath.split("/").pop() || "MeterFlo_Backup.zip";
    
    const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      filename,
      "application/zip"
    );
    
    await FileSystem.writeAsStringAsync(newFileUri, base64Content, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const folderName = decodeURIComponent(directoryUri.split("%3A").pop() || "selected folder");
    return folderName;
  } catch (error) {
    console.error("[Backup] Error saving to folder:", error);
    throw error;
  }
}
