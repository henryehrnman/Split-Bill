import React from 'react';
import {Tabs} from 'expo-router';
import {View,Text} from 'react-native';
import {useFonts} from 'expo-font';
import {DMSans_400Regular} from '@expo-google-fonts/dm-sans/400Regular';
import {DMSans_500Medium} from '@expo-google-fonts/dm-sans/500Medium';
import {DMSans_700Bold} from '@expo-google-fonts/dm-sans/700Bold';
import {Provider,C,Icon} from '../lib/ui';
export default function Layout(){const [loaded,error]=useFonts({'DM-Regular':DMSans_400Regular,'DM-Medium':DMSans_500Medium,'DM-Bold':DMSans_700Bold});if(!loaded&&!error)return <View style={{flex:1,backgroundColor:'white',alignItems:'center',justifyContent:'center'}}><Text>Opening Split Bill…</Text></View>;return <Provider><View style={{flex:1,backgroundColor:'#e9ecf1'}}><View style={{flex:1,width:'100%',maxWidth:480,alignSelf:'center'}}><Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:C.blue,tabBarInactiveTintColor:'#767e8c',tabBarStyle:{height:76,paddingTop:10,paddingBottom:12,borderTopColor:C.line,elevation:0},tabBarLabelStyle:{fontFamily:'DM-Medium',fontSize:11,marginTop:3}}}><Tabs.Screen name="index" options={{title:'Home',tabBarIcon:({color})=><Icon name="home" color={typeof color==='string'?color:C.muted}/>}}/><Tabs.Screen name="split" options={{title:'Split',tabBarIcon:({color})=><Icon name="users" color={typeof color==='string'?color:C.muted}/>}}/><Tabs.Screen name="card" options={{title:'Card',tabBarIcon:({color})=><Icon name="credit-card" color={typeof color==='string'?color:C.muted}/>}}/><Tabs.Screen name="activity" options={{title:'Activity',tabBarIcon:({color})=><Icon name="clock" color={typeof color==='string'?color:C.muted}/>}}/><Tabs.Screen name="profile" options={{href:null}}/></Tabs></View></View></Provider>}
