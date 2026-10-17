import React from 'react';
import {Tabs} from 'expo-router';
import {C, Icon} from '../../lib/ui';

const tab = (title: string, icon: React.ComponentProps<typeof Icon>['name']) => ({
  title,
  tabBarIcon: ({color}: {color: unknown}) => <Icon name={icon} color={typeof color === 'string' ? color : C.muted} />,
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: '#767e8c',
        tabBarStyle: {height: 76, paddingTop: 10, paddingBottom: 12, borderTopColor: C.line, elevation: 0},
        tabBarLabelStyle: {fontFamily: 'DM-Medium', fontSize: 11, marginTop: 3},
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home')} />
      <Tabs.Screen name="split" options={tab('Split', 'users')} />
      <Tabs.Screen name="card" options={tab('Card', 'credit-card')} />
      <Tabs.Screen name="activity" options={tab('Activity', 'clock')} />
    </Tabs>
  );
}
