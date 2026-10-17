import React,{useState} from 'react';
import {View,Pressable} from 'react-native';
import {router} from 'expo-router';
import {Page,T,Button,Avatar,Icon,s,C,names,useApp} from '../lib/ui';
import {money} from '../lib/engine';
export default function Activity(){
 const {state,receipts,dispatch,storageNotice}=useApp();
 const [selected,setSelected]=useState<string|null>(null);
 const current=state.receipt&&state.card?.wallet?{...state.receipt,wallet:state.card.wallet}:null;
 const history=current&&!receipts.some(r=>r.id===current.id)?[current,...receipts]:receipts;
 const r=history.find(r=>r.id===selected)??history[0];
 return <Page title="Activity" subtitle="Your splits, in one place.">
  <T style={s.small}>Saved on this device only · simulated payments</T>
  {!!storageNotice&&<T accessibilityRole="alert" style={s.notice}>{storageNotice}</T>}
  {r?<>
   <View style={{alignItems:'center',paddingVertical:25}}><Icon name="check-circle" color={C.success} size={32}/><T style={{fontWeight:'700',fontSize:20,marginTop:16}}>Dinner at Juniper</T><T style={[s.money,{marginVertical:8}]}>{money(r.total)}</T><T style={{fontSize:12,color:C.success}}>Demo payment completed</T></View>
   <View style={s.row}><T style={s.small}>Simulated wallet</T><T style={{fontSize:13,fontWeight:'500'}}>{r.wallet}</T></View>
   <T style={s.section}>Split between</T>
   {names.map((n,i)=><View key={n} style={s.listRow}><Avatar index={i} size={36}/><T style={{flex:1,fontWeight:'500'}}>{n}{i===0?' (you)':''}</T><T style={{fontWeight:'700'}}>{money(r.shares[i])}</T></View>)}
   <T style={[s.caption,{marginTop:24}]}>Demo reference: {r.id}{'\n'}No money was transferred.</T>
   <T style={s.section}>Receipt history</T>
   {history.map((receipt,i)=><Pressable key={receipt.id} accessibilityRole="button" accessibilityLabel={'Open demo receipt '+receipt.id} accessibilityState={{selected:r.id===receipt.id}} onPress={()=>setSelected(receipt.id)} style={s.listRow}><Icon name="file-text" color={r.id===receipt.id?C.blue:C.muted}/><View style={{flex:1}}><T>Demo dinner {history.length-i}</T><T style={s.caption}>{receipt.id}</T></View><T>{money(receipt.total)}</T></Pressable>)}
   <Button title="Start another split" onPress={()=>{dispatch({type:'reset'});router.push('/split');}}/>
  </>:<View style={{alignItems:'center',paddingTop:70,paddingBottom:40}}><Icon name="file-text" size={32} color={C.muted}/><T style={{fontSize:21,fontWeight:'700',marginTop:24}}>Nothing to settle. Yet.</T><T style={[s.small,{textAlign:'center',marginTop:10,marginBottom:24}]}>Complete your first group payment to see everyone’s share here.</T><Button title="Go to your split" onPress={()=>router.push('/split')}/></View>}
 </Page>
}
