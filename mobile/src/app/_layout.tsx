import React from 'react';
import {Stack} from 'expo-router';
import {View, Text} from 'react-native';
import {useFonts} from 'expo-font';
import {DMSans_400Regular} from '@expo-google-fonts/dm-sans/400Regular';
import {DMSans_500Medium} from '@expo-google-fonts/dm-sans/500Medium';
import {DMSans_700Bold} from '@expo-google-fonts/dm-sans/700Bold';
import {StoreProvider} from '../lib/store';

export default function Layout() {
  const [loaded, error] = useFonts({'DM-Regular': DMSans_400Regular, 'DM-Medium': DMSans_500Medium, 'DM-Bold': DMSans_700Bold});
  if (!loaded && !error) {
    return (
      <View style={{flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center'}}>
        <Text>Opening Split Bill…</Text>
      </View>
    );
  }
  return (
    <StoreProvider>
      <View style={{flex: 1, backgroundColor: '#e9ecf1'}}>
        <View style={{flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center'}}>
          <Stack screenOptions={{headerShown: false, contentStyle: {backgroundColor: 'white'}}}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="new-group" />
          </Stack>
        </View>
      </View>
    </StoreProvider>
  );
}
