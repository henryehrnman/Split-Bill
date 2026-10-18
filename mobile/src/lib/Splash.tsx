import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';

// One loading screen for every startup step (fonts, session, first fetch), so the app doesn't flash
// a different message for each. Text and actions only appear if the wait runs long, or right away for an error.
export function Splash({children, immediate = false}: {children?: React.ReactNode; immediate?: boolean}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{flex: 1, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16}}>
      {!immediate && <ActivityIndicator color="#2459e8" />}
      {(slow || immediate) && children}
    </View>
  );
}

export const splashText = {fontFamily: 'DM-Regular', fontSize: 15, color: '#626a78', textAlign: 'center'} as const;
export const splashLink = {fontFamily: 'DM-Medium', fontSize: 15, color: '#2459e8'} as const;
