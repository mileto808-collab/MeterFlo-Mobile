import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ColumnsScreen from "@/screens/ColumnsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ColumnsStackParamList = {
  Columns: undefined;
};

const Stack = createNativeStackNavigator<ColumnsStackParamList>();

export default function ColumnsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Columns"
        component={ColumnsScreen}
        options={{
          headerTitle: "Columns",
        }}
      />
    </Stack.Navigator>
  );
}
