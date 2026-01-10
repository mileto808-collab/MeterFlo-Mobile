import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    if (params) {
      (navigationRef.navigate as (name: string, params: object) => void)(name, params);
    } else {
      (navigationRef.navigate as (name: string) => void)(name);
    }
  }
}
