import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/lib/theme-context";

// Intro animation for the splash:
//  · "ask" slides in from the left, "ero" from the right (fade + translate)
//  · the "0" pops in — scale 0.2→1, rotate −90°→0°, fade in
//
// NOTE: we deliberately do NOT animate the stroke-dash "self-draw" here. On the
// new architecture (Fabric), react-native-svg's getTotalLength() / animated
// AnimatedPath dash offset is unreliable and can crash the renderer
// ("expecting RNSVGRenderable, got null"). Rendering the ring statically and
// animating the container is rock-solid and reads almost identically.
const BEZIER = Easing.bezier(0.2, 0.8, 0.2, 1);

const BLACK_D = "M 0,-22 A 22,22 0 1 1 15,-15";
const PURPLE_D = "M 15,-15 A 22,22 0 1 1 0,-22";

export function LogoIntro({
  size = 64,
  onDone,
}: {
  size?: number;
  onDone?: () => void;
}) {
  const { colors } = useTheme();
  const svg = size * 0.78;
  const stroke = 9; // viewBox units (viewBox padded so the round cap isn't clipped)

  const askX = useRef(new Animated.Value(-60)).current;
  const askO = useRef(new Animated.Value(0)).current;
  const eroX = useRef(new Animated.Value(60)).current;
  const eroO = useRef(new Animated.Value(0)).current;
  const zeroScale = useRef(new Animated.Value(0.2)).current;
  const zeroRot = useRef(new Animated.Value(0)).current; // 0→1 maps to −90°→0°
  const zeroO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(askX, { toValue: 0, duration: 700, delay: 100, easing: BEZIER, useNativeDriver: true }),
      Animated.timing(askO, { toValue: 1, duration: 700, delay: 100, easing: BEZIER, useNativeDriver: true }),
      Animated.timing(eroX, { toValue: 0, duration: 700, delay: 100, easing: BEZIER, useNativeDriver: true }),
      Animated.timing(eroO, { toValue: 1, duration: 700, delay: 100, easing: BEZIER, useNativeDriver: true }),
      Animated.timing(zeroScale, { toValue: 1, duration: 800, delay: 450, easing: BEZIER, useNativeDriver: true }),
      Animated.timing(zeroRot, { toValue: 1, duration: 800, delay: 450, easing: BEZIER, useNativeDriver: true }),
      Animated.timing(zeroO, { toValue: 1, duration: 600, delay: 450, easing: BEZIER, useNativeDriver: true }),
    ]);
    anim.start(() => onDone?.());
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = zeroRot.interpolate({
    inputRange: [0, 1],
    outputRange: ["-90deg", "0deg"],
  });

  const word = {
    fontSize: size,
    color: colors.text,
    fontWeight: "500" as const,
    letterSpacing: -size * 0.042,
  };

  return (
    <View style={styles.row}>
      <Animated.Text style={[word, { opacity: askO, transform: [{ translateX: askX }] }]}>
        ask
      </Animated.Text>

      <Animated.View
        style={{
          width: svg,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          opacity: zeroO,
          transform: [{ scale: zeroScale }, { rotate }],
        }}
      >
        <Svg width={svg} height={svg} viewBox="-28 -28 56 56">
          <Path
            d={BLACK_D}
            fill="none"
            stroke={colors.text}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <Path
            d={PURPLE_D}
            fill="none"
            stroke={colors.accentBright}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.Text style={[word, { marginLeft: -2, opacity: eroO, transform: [{ translateX: eroX }] }]}>
        ero
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
