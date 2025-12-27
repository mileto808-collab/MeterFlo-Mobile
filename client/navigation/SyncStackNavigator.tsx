import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SyncScreen from "@/screens/SyncScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SyncStackParamList = {
  Sync: undefined;
};

const Stack = createNativeStackNavigator<SyncStackParamList>();

export default function SyncStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Sync"
        component={SyncScreen}
        options={{
          headerTitle: "Sync Status",
        }}
      />
    </Stack.Navigator>
  );
}
