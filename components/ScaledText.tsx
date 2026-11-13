import React,{forwardRef} from 'react';
import {Text as NativeText,type TextProps} from 'react-native';
export const ScaledText=forwardRef<NativeText,TextProps>(function ScaledText({style,...props},ref){
 return <NativeText ref={ref} {...props} allowFontScaling={false} style={style}/>;
});
