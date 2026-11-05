import React, { useId } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";
import { getCosmetic, type CosmeticKind } from "@shared/cosmetics";

type CosmeticArtworkProps = {
  kind: CosmeticKind;
  itemId: string;
  size?: number;
  height?: number;
};

function Diamond({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return <Polygon points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`} fill={color} />;
}

export function CosmeticArtwork({ kind, itemId, size = 72, height = size }: CosmeticArtworkProps) {
  const instanceId = useId().replace(/:/g, "");
  const item = getCosmetic(kind, itemId);
  const [accent, highlight, deep] = item?.colors ?? ["#33C5A1", "#B6F3E2", "#12634F"];
  const gradientId = `cosmetic-${instanceId}`;
  const isMarrakech = itemId.includes("marrakech");
  const isZellige = itemId.includes("zellige") || itemId.includes("mosaic") || itemId.includes("eid");
  const isGold = itemId.includes("gold") || itemId.includes("ramadan") || itemId.includes("atlas_frame");
  const isViolet = itemId.includes("aurora") || itemId.includes("calligraphy") || itemId.includes("starlight");
  const isWinter = itemId.includes("winter");

  return (
    <Svg width={size} height={height} viewBox="0 0 120 120" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={highlight} />
          <Stop offset="0.52" stopColor={accent} />
          <Stop offset="1" stopColor={deep} />
        </LinearGradient>
      </Defs>

      {kind !== "frame" ? (
        <>
          <Rect x="3" y="3" width="114" height="114" rx="28" fill={`url(#${gradientId})`} />
          <Circle cx="97" cy="21" r="28" fill="#FFFFFF" opacity="0.1" />
          <Circle cx="17" cy="101" r="28" fill={deep} opacity="0.28" />
          <Path d="M12 30h22M23 19v22M91 96h18M100 87v18" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.18" />
        </>
      ) : null}

      {kind === "frame" ? (
        <>
          <Circle cx="60" cy="60" r="49" fill="none" stroke={deep} strokeWidth="13" opacity="0.42" />
          <Circle cx="60" cy="58" r="45" fill="none" stroke={`url(#${gradientId})`} strokeWidth="10" />
          <Circle cx="60" cy="58" r="39" fill="none" stroke={highlight} strokeWidth="1.8" opacity="0.9" />
          <Path d="M60 10v12M60 96v12M12 58h12M96 58h12" stroke={highlight} strokeWidth="2" strokeLinecap="round" />
          {isZellige ? (
            <>
              <Diamond x={27} y={24} size={7} color={highlight} />
              <Diamond x={93} y={24} size={7} color={highlight} />
              <Diamond x={27} y={92} size={7} color={highlight} />
              <Diamond x={93} y={92} size={7} color={highlight} />
              <Circle cx="60" cy="11" r="3" fill="#FFFFFF" />
              <Circle cx="60" cy="105" r="3" fill="#FFFFFF" />
            </>
          ) : isGold ? (
            <>
              <Path d="m60 5 4 9-4 9-4-9zM60 95l4 9-4 9-4-9z" fill="#FFF2BC" />
              <Circle cx="19" cy="58" r="4" fill={highlight} stroke="#FFF2BC" strokeWidth="1.5" />
              <Circle cx="101" cy="58" r="4" fill={highlight} stroke="#FFF2BC" strokeWidth="1.5" />
            </>
          ) : (
            <>
              <Path d="m60 7 3 8-3 8-3-8zM60 95l3 8-3 8-3-8z" fill="#FFFFFF" />
              <Circle cx="17" cy="58" r="3" fill={highlight} />
              <Circle cx="103" cy="58" r="3" fill={highlight} />
            </>
          )}
          <Circle cx="60" cy="13" r="2" fill="#FFFFFF" opacity="0.9" />
          <Circle cx="60" cy="103" r="2" fill="#FFFFFF" opacity="0.9" />
        </>
      ) : null}

      {kind === "background" ? (
        <>
          <Circle cx={isMarrakech ? 86 : 88} cy="30" r={isMarrakech ? 13 : 11} fill="#FFF0C4" />
          {isWinter ? (
            <Path d="M88 15v30m-13-23 26 16m0-16L75 38" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          ) : null}
          <Path d="M3 83 32 48l22 30z" fill={highlight} opacity="0.76" />
          <Path d="m36 82 31-45 47 45z" fill="#FFFFFF" opacity="0.54" />
          <Path d="m3 84 29-34 15 18 10-13 25 29z" fill={accent} />
          <Path d="m38 83 29-46 47 46z" fill={deep} opacity="0.76" />
          <Path d="M3 84h114v27H3z" fill={deep} />
          {isMarrakech ? (
            <>
              <Path d="M18 84V65q0-18 17-18t17 18v19z" fill={highlight} />
              <Path d="M23 84V66q0-12 12-12t12 12v18z" fill={deep} />
              <Path d="M76 84V67q0-9 9-9t9 9v17z" fill={accent} />
              <Path d="M81 84V68q0-5 4-5t4 5v16z" fill={deep} />
            </>
          ) : (
            <>
              <Path d="M47 84V66q0-13 13-13t13 13v18z" fill={highlight} />
              <Path d="M53 84V67q0-7 7-7t7 7v17z" fill={deep} />
              <Path d="m60 43 5 9h-10z" fill="#FFFFFF" opacity="0.7" />
            </>
          )}
          <Circle cx="20" cy="35" r="1.8" fill="#FFFFFF" />
          <Circle cx="41" cy="27" r="1.8" fill="#FFFFFF" />
          <Circle cx="60" cy="31" r="1.4" fill="#FFFFFF" />
          <Circle cx="30" cy="39" r="1.2" fill="#FFFFFF" />
        </>
      ) : null}

      {kind === "nameplate" ? (
        <>
          <Path d="m15 38 12-8-12-8-10 8zM105 38l-12-8 12-8 10 8z" fill={highlight} stroke="#FFFFFF" strokeWidth="1.5" />
          <Path d="m15 60 12-9-12-9-10 9zM105 60l-12-9 12-9 10 9z" fill={deep} opacity="0.88" />
          <Rect x="13" y="37" width="94" height="49" rx="16" fill={deep} stroke={`url(#${gradientId})`} strokeWidth="5" />
          <Rect x="21" y="44" width="78" height="34" rx="11" fill="#FFFFFF" opacity="0.1" />
          <Path d="M38 59h44" stroke={highlight} strokeWidth="4" strokeLinecap="round" />
          <Path d="M48 69h24" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <Path d="M25 42h70" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.42" />
          {isGold || isZellige ? (
            <>
              <Diamond x={20} y={60} size={5} color={highlight} />
              <Diamond x={100} y={60} size={5} color={highlight} />
            </>
          ) : (
            <>
              <Circle cx="22" cy="60" r="2.5" fill="#FFFFFF" />
              <Circle cx="98" cy="60" r="2.5" fill="#FFFFFF" />
            </>
          )}
        </>
      ) : null}

      {kind === "victory" ? (
        <>
          <Ellipse cx="60" cy="101" rx="31" ry="6" fill={deep} opacity="0.42" />
          <Path d="M42 34h36v14q0 18-18 21-18-3-18-21z" fill={highlight} stroke="#FFFFFF" strokeWidth="2" />
          <Path d="M42 41H27v8q0 13 18 15M78 41h15v8q0 13-18 15" fill="none" stroke={highlight} strokeWidth="7" strokeLinecap="round" />
          <Path d="M49 42h22v12q-1 8-11 10-10-2-11-10z" fill={accent} opacity="0.78" />
          <Rect x="54" y="67" width="12" height="14" rx="3" fill={highlight} />
          <Path d="M43 86h34v9H43z" fill={`url(#${gradientId})`} stroke="#FFFFFF" strokeWidth="1.5" />
          {isViolet ? (
            <>
              <Path d="m24 26 4 10-4 10-4-10zM96 45l4 10-4 10-4-10zM31 72l3 7-3 7-3-7z" fill="#FFFFFF" />
              <Circle cx="32" cy="22" r="2.5" fill={highlight} />
              <Circle cx="91" cy="27" r="2.5" fill="#FFFFFF" />
            </>
          ) : isGold ? (
            <>
              <Path d="m24 29 5 11-5 11-5-11zM96 28l5 11-5 11-5-11z" fill="#FFF2BC" />
              <Circle cx="31" cy="72" r="3" fill="#FFFFFF" />
              <Circle cx="89" cy="73" r="3" fill={highlight} />
            </>
          ) : (
            <>
              <Circle cx="23" cy="31" r="4" fill="#FFFFFF" />
              <Circle cx="97" cy="27" r="3" fill={highlight} />
              <Rect x="27" y="58" width="5" height="12" rx="2.5" fill="#FFFFFF" transform="rotate(-25 29 64)" />
              <Rect x="88" y="57" width="5" height="12" rx="2.5" fill={highlight} transform="rotate(25 90 63)" />
            </>
          )}
        </>
      ) : null}

      {kind === "seasonal" ? (
        isWinter ? (
          <>
            <Path d="M60 20v68m-29-51 58 34m0-34L31 71M46 26l14 11 14-11M46 82l14-11 14 11" fill="none" stroke={highlight} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="60" cy="54" r="11" fill={accent} stroke="#FFFFFF" strokeWidth="2.5" />
            <Circle cx="60" cy="54" r="4" fill="#FFFFFF" />
          </>
        ) : itemId.includes("ramadan") ? (
          <>
            <Path d="M60 15v13m-24 0h48l-7 10H43z" fill={highlight} stroke="#FFFFFF" strokeWidth="2" />
            <Path d="M43 38h34v40q0 13-17 18-17-5-17-18z" fill={`url(#${gradientId})`} stroke="#FFFFFF" strokeWidth="2" />
            <Path d="M50 46h20v27H50z" fill={deep} />
            <Path d="M60 48v23m-7-12h14" stroke={highlight} strokeWidth="2" />
            <Circle cx="60" cy="60" r="5" fill="#FFF0C4" />
            <Path d="M34 99h52" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <Circle cx="29" cy="36" r="2" fill="#FFFFFF" />
            <Circle cx="93" cy="42" r="2" fill="#FFFFFF" />
          </>
        ) : (
          <>
            <Rect x="25" y="25" width="70" height="70" rx="16" fill="none" stroke={highlight} strokeWidth="4" />
            <Rect x="32" y="32" width="56" height="56" rx="12" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.72" />
            <Path d="m60 27 10 17 18 10-18 10-10 18-10-18-18-10 18-10z" fill={accent} stroke="#FFFFFF" strokeWidth="2" />
            <Circle cx="60" cy="54" r="9" fill={highlight} />
            <Diamond x={33} y={33} size={5} color="#FFFFFF" />
            <Diamond x={87} y={33} size={5} color="#FFFFFF" />
            <Diamond x={33} y={87} size={5} color="#FFFFFF" />
            <Diamond x={87} y={87} size={5} color="#FFFFFF" />
          </>
        )
      ) : null}
    </Svg>
  );
}
