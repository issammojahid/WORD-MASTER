import React from "react";
import { Image, type ImageSourcePropType } from "react-native";
import type { SkinId } from "@/contexts/PlayerContext";

const AVATAR_ARTWORK: Record<SkinId, ImageSourcePropType> = {
  student: require("../assets/avatars/student.png"),
  djellaba: require("../assets/avatars/djellaba.png"),
  sport: require("../assets/avatars/sport.png"),
  champion: require("../assets/avatars/champion.png"),
  kaftan: require("../assets/avatars/kaftan.png"),
  fassi: require("../assets/avatars/fassi.png"),
  sahrawi: require("../assets/avatars/sahrawi.png"),
  amazigh: require("../assets/avatars/amazigh.png"),
  ninja: require("../assets/avatars/ninja.png"),
  astronaut: require("../assets/avatars/astronaut.png"),
  king: require("../assets/avatars/king.png"),
  hacker: require("../assets/avatars/hacker.png"),
  superhero: require("../assets/avatars/superhero.png"),
  legend: require("../assets/avatars/legend.png"),
  elite: require("../assets/avatars/elite.png"),
  tourChamp: require("../assets/avatars/tourChamp.png"),
  vip_phoenix: require("../assets/avatars/vip_phoenix.png"),
  vip_sultan: require("../assets/avatars/vip_sultan.png"),
  vip_cyber: require("../assets/avatars/vip_cyber.png"),
};

type AvatarArtworkProps = {
  skinId?: SkinId;
  size?: number;
};

export function AvatarArtwork({ skinId = "student", size = 48 }: AvatarArtworkProps) {
  return (
    <Image
      source={AVATAR_ARTWORK[skinId]}
      style={{ width: size, height: size }}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}
