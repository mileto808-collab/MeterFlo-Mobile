import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WorkOrdersScreen from "@/screens/WorkOrdersScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type WorkOrdersStackParamList = {
  WorkOrders: undefined;
};

const Stack = createNativeStackNavigator<WorkOrdersStackParamList>();

export default function WorkOrdersStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="WorkOrders"
        component={WorkOrdersScreen}
        options={{
          headerTitle: () => <HeaderTitle title="MeterFlo" />,
        }}
      />
    </Stack.Navigator>
  );
}
