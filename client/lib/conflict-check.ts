export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType: "claimed" | "completed" | null;
  conflictUser: string | null;
}

export async function checkWorkOrderConflict(
  workOrderId: string | number,
  serverUrl: string,
  projectId: string,
  currentUsername: string,
  authHeaders: Record<string, string>
): Promise<ConflictCheckResult> {
  const result: ConflictCheckResult = {
    hasConflict: false,
    conflictType: null,
    conflictUser: null,
  };

  try {
    console.log(`[ConflictCheck] Fetching WO ${workOrderId} to check claim status...`);
    
    const response = await fetch(
      `${serverUrl}/api/mobile/workorders/${workOrderId}?projectId=${projectId}`,
      {
        method: "GET",
        headers: authHeaders,
      }
    );

    if (!response.ok) {
      console.warn(`[ConflictCheck] Could not fetch WO ${workOrderId}, status: ${response.status}`);
      return result;
    }

    const data = await response.json();
    const serverWo = data.workOrder || data;
    
    const assignedUsername = 
      serverWo.assigned_to_username || 
      serverWo.assignedToUsername || 
      serverWo.assignedUserUsername ||
      serverWo.assigned_user_username;
      
    const completedByUsername = 
      serverWo.completed_by_username || 
      serverWo.completedByUsername || 
      serverWo.completedBy ||
      serverWo.completed_by;
      
    const serverStatus = (serverWo.status || "").toLowerCase();
    const currentUserLower = currentUsername.toLowerCase();

    console.log(`[ConflictCheck] WO ${workOrderId} - status: ${serverStatus}, assigned: ${assignedUsername || "none"}, completedBy: ${completedByUsername || "none"}`);

    if (assignedUsername && assignedUsername.toLowerCase() !== currentUserLower) {
      console.log(`[ConflictCheck] WO ${workOrderId} is claimed by ${assignedUsername} (current: ${currentUsername}) - CONFLICT`);
      return {
        hasConflict: true,
        conflictType: "claimed",
        conflictUser: assignedUsername,
      };
    }

    if ((serverStatus === "completed" || serverStatus === "closed") && 
        completedByUsername && 
        completedByUsername.toLowerCase() !== currentUserLower) {
      console.log(`[ConflictCheck] WO ${workOrderId} was completed by ${completedByUsername} (current: ${currentUsername}) - CONFLICT`);
      return {
        hasConflict: true,
        conflictType: "completed",
        conflictUser: completedByUsername,
      };
    }

    console.log(`[ConflictCheck] WO ${workOrderId} - no conflict detected`);
    return result;
  } catch (error) {
    console.warn(`[ConflictCheck] Error checking WO ${workOrderId}:`, error);
    return result;
  }
}
