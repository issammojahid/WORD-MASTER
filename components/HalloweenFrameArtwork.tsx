import React, { useId } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { HalloweenPreviewAsset } from "@/constants/halloween-preview";

export function HalloweenFrame({ asset, size }: { asset: HalloweenPreviewAsset; size: number }) {
  const id = "halloween-" + useId().replace(/:/g, "");
  const variant = Number(asset.previewKey.slice(-2)) - 1;
  const colors = ["#FF9B28", "#B785FF", "#74E7BB", "#FFC85A", "#EE86C6", "#89BEFF"];
  const accent = colors[variant % colors.length];
  return <Svg width={size} height={size} viewBox="0 0 120 120">
    <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF1BD" /><Stop offset="0.45" stopColor={accent} /><Stop offset="1" stopColor="#7542AE" /></LinearGradient></Defs>
    <Circle cx="60" cy="60" r="51" stroke="#1D0B30" strokeWidth="9" fill="none" />
    <Circle cx="60" cy="60" r="51" stroke={`url(#${id})`} strokeWidth="5" fill="none" />
    <Circle cx="60" cy="60" r="46" stroke={accent} strokeWidth="1" fill="none" opacity="0.8" />
    {Array.from({length: variant + 6}, (_, i) => {
      const angle = 2 * Math.PI * i / (variant + 6);
      return <Circle key={i} cx={60 + 52 * Math.cos(angle)} cy={60 + 52 * Math.sin(angle)} r="2.3" fill="#FFF1BD" />;
    })}
    {variant % 3 === 0 ? <>
      <Path d="M52 10q8-14 16 0l-3 9H55z" fill="#FF9B28" stroke="#FFE6A5" strokeWidth="1" />
      <Path d="m56 10 2-3 2 3m2 0 2-3 2 3M57 14q3 4 6 0" stroke="#35122D" strokeWidth="1.5" fill="none" />
      <Path d="M60 3q-1-5 4-5" stroke="#74E7BB" strokeWidth="2" fill="none" />
    </> : variant % 3 === 1 ? <Path d="M60 6q-11-5-20 1l8 1-3 7 9-4 6 7 6-7 9 4-3-7 8-1q-9-6-20-1z" fill={accent} stroke="#FFF1BD" strokeWidth="1" /> : <Path d="m60 0 4 8 9 2-7 5 1 9-7-5-7 5 1-9-7-5 9-2z" fill={accent} stroke="#FFF1BD" strokeWidth="1" />}
    <Path d="m60 104 4 6-4 7-4-7z" fill={accent} stroke="#FFF1BD" strokeWidth="1" />
  </Svg>;
}
