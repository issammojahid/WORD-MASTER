import React,{forwardRef} from 'react';
import {Text as NativeText,StyleSheet,type TextProps} from 'react-native';
import {useInterfacePreferences} from '@/lib/interface-preferences';
export const ScaledText=forwardRef<NativeText,TextProps>(function ScaledText({style,...props},ref){
 const {textScale=1}=useInterfacePreferences(),flat=StyleSheet.flatten(style);
 return <NativeText ref={ref} {...props} style={[style,textScale!==1&&flat?.fontSize?{fontSize:flat.fontSize*textScale,...(flat.lineHeight?{lineHeight:flat.lineHeight*textScale}:{})}:null]}/>;
});
