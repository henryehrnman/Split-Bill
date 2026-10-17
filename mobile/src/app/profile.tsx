import React,{useState} from 'react';
import {Linking,View} from 'react-native';
import {router} from 'expo-router';
import {Page,T,Avatar,Button,s,useApp} from '../lib/ui';
export default function Profile(){
 const {dispatch,clearHistory,storageNotice}=useApp();const [confirm,setConfirm]=useState(false);
 return <Page title="Your account">
  <View style={{flexDirection:'row',gap:16,alignItems:'center',paddingVertical:28}}><Avatar size={64}/><View><T style={{fontSize:21,fontWeight:'700'}}>Henry Ehrnman</T><T style={s.small}>Demo profile</T></View></View>
  <T style={s.section}>Payment methods</T><T>Checking • 1024</T><T style={s.caption}>Sample account · no bank connected</T>
  <T style={s.section}>About this prototype</T><T style={s.small}>Accounts, approvals, cards and payments are simulated. Wallet setup doesn’t add a real card. Drafts and up to 100 receipts are saved on this device only, not synced with other people. Reopening requires fresh approvals and a new demo card.</T>
  {!!storageNotice&&<T accessibilityRole="alert" style={s.notice}>{storageNotice}</T>}
  <Button secondary title="Project plan & progress" onPress={()=>Linking.openURL('https://split-bill-henry.coralspark257.chatgpt.site/plan.html')}/>
  <T style={s.section}>Demo data</T>
  <Button secondary title="Restart split · keep receipts" onPress={()=>{dispatch({type:'reset'});router.replace('/');}}/>
  <Button secondary title="Clear saved demo data" onPress={()=>setConfirm(true)}/>
  {confirm&&<><T style={s.small}>Delete this device’s draft and receipt history? This cannot be undone.</T><Button title="Delete demo data" onPress={()=>{clearHistory();setConfirm(false);router.replace('/');}}/><Button secondary title="Keep my data" onPress={()=>setConfirm(false)}/></>}
  <T style={[s.caption,{marginTop:30}]}>Split Bill · iOS, Android & web prototype</T>
 </Page>
}
