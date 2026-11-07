import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import { useReducedMotion } from "@/components/GameUi";
import { useLanguage } from "@/contexts/LanguageContext";

type MotionKind = "avatar" | "frame" | "nameplate" | "background" | "icon" | "victory";
const MotionContext = createContext<Animated.Value | null>(null);

// One shared native-driver clock per visible composition, never per shop tile.
// Stop when the screen loses focus, the app backgrounds, or motion is disabled.
export function HalloweenMotionScene({ children, style, effects = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; effects?: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const { language } = useLanguage();
  const running = !paused && !reduced;

  useFocusEffect(useCallback(() => {
    if (!running) { progress.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 6400, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    const start = () => { progress.setValue(0); loop.start(); };
    if (AppState.currentState === "active" || AppState.currentState == null) start();
    const subscription = AppState.addEventListener("change", state => {
      loop.stop();
      if (state === "active") start();
    });
    return () => { subscription.remove(); loop.stop(); progress.stopAnimation(); progress.setValue(0); };
  }, [progress, running]));

  return <MotionContext.Provider value={running ? progress : null}>
    <View style={style}>
      {children}
      {effects && running ? <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 8 }, (_, i) => <Animated.Text key={i} style={{position:"absolute",left:`${8+i*12}%`,top:`${18+(i%3)*22}%`,color:i%2 ? "#CBA7FF" : "#FFE6A5",fontSize:9+(i%3)*3,opacity:progress.interpolate({inputRange:[0,0.2,0.55,0.85,1],outputRange:[0,0.55,0.18,0.6,0]}),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[8,-18]})},{scale:progress.interpolate({inputRange:[0,0.5,1],outputRange:[0.7,1.1,0.7]})}]}}>✦</Animated.Text>)}
      </View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={language === "ar" ? running ? "إيقاف حركة هالوين" : "تشغيل حركة هالوين" : running ? "Pause Halloween animations" : "Play Halloween animations"} accessibilityState={{disabled:reduced}} disabled={reduced} onPress={()=>setPaused(value=>!value)} style={s.control}>
        <Text style={s.controlText}>{reduced ? language === "ar" ? "حركة مخففة" : "Reduced motion" : running ? "Ⅱ" : "▶"}</Text>
      </Pressable>
    </View>
  </MotionContext.Provider>;
}

export function HalloweenMotionLayer({ children, kind, style }: { children: React.ReactNode; kind: MotionKind; style?: StyleProp<ViewStyle> }) {
  const progress = useContext(MotionContext);
  if (!progress) return <View style={style}>{children}</View>;
  const pulse = (low: number, high: number) => progress.interpolate({inputRange:[0,0.5,1],outputRange:[low,high,low]});
  const motion = kind === "background" ? {transform:[{scale:pulse(1,1.035)}]}
    : kind === "avatar" ? {transform:[{translateY:pulse(0,-3)}]}
    : kind === "frame" ? {opacity:pulse(0.88,1),transform:[{scale:pulse(1,1.035)}]}
    : kind === "nameplate" ? {opacity:pulse(1,0.94)}
    : kind === "icon" ? {transform:[{translateY:pulse(0,-4)},{rotate:progress.interpolate({inputRange:[0,0.25,0.5,0.75,1],outputRange:["0deg","-4deg","0deg","4deg","0deg"]})}]}
    : {opacity:pulse(0.85,1),transform:[{scale:pulse(1,1.08)},{rotate:progress.interpolate({inputRange:[0,0.5,1],outputRange:["-3deg","3deg","-3deg"]})}]};
  return <Animated.View style={[style,motion]}>{children}</Animated.View>;
}

const s=StyleSheet.create({control:{position:"absolute",top:10,left:10,minWidth:36,minHeight:36,borderRadius:18,alignItems:"center",justifyContent:"center",paddingHorizontal:9,backgroundColor:"rgba(20,10,35,0.75)",borderColor:"#CBA7FF70",borderWidth:1},controlText:{color:"#FFE6A5",fontSize:12,fontFamily:"Cairo_600SemiBold"}});
