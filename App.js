import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from './context/AppContext';

// Screens
import PaperTradingHomeScreen from './screens/PaperTradingHomeScreen';
import OptionChainScreen from './screens/OptionChainScreen';
import PositionsScreen from './screens/PositionsScreen';
import PerformanceScreen from './screens/PerformanceScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="PaperTradingHome"
          screenOptions={{
            headerStyle: { backgroundColor: '#1E293B' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          <Stack.Screen 
            name="PaperTradingHome" 
            component={PaperTradingHomeScreen} 
            options={{ title: 'Front Page Paper Trading', headerShown: false }} 
          />
          <Stack.Screen 
            name="OptionChain" 
            component={OptionChainScreen} 
            options={({ route }) => ({ title: `${route.params?.symbol} Option Chain` })} 
          />
          <Stack.Screen 
            name="Positions" 
            component={PositionsScreen} 
            options={{ title: 'Open Positions' }} 
          />
          <Stack.Screen 
            name="Performance" 
            component={PerformanceScreen} 
            options={{ title: 'Performance & History' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
