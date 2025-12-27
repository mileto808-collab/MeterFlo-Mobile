import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AccountScreen from "@/screens/AccountScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AccountStackParamList = {
  Account: undefined;
};

const Stack = createNativeStackNavigator<AccountStackParamList>();

export default function AccountStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{
          headerTitle: "Account",
        }}
      />
    </Stack.Navigator>
  );
}
