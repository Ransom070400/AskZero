import { Text, View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/theme";

interface LogoProps {
  size?: number;
  color?: string;
}

// Static AskZero wordmark: "ask" + two-arc "0" (foreground + purple accent) +
// "ero". For the animated splash version see LogoIntro.
export function Logo({ size = 28, color = colors.text }: LogoProps) {
  const zero = size * 0.78;
  const stroke = 9; // viewBox units (padded viewBox so the round stroke isn't clipped)

  return (
    <View style={styles.row} accessibilityLabel="askzero">
      {word("ask", size, color)}
      <View style={[styles.zeroBox, { width: zero, height: size }]}>
        <Svg width={zero} height={zero} viewBox="-28 -28 56 56">
          <Path
            d="M 0,-22 A 22,22 0 1 1 15,-15"
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <Path
            d="M 15,-15 A 22,22 0 1 1 0,-22"
            fill="none"
            stroke={colors.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      {word("ero", size, color, -2)}
    </View>
  );
}

function word(text: string, size: number, color: string, marginLeft = 0) {
  return (
    <Text
      style={[
        styles.word,
        { fontSize: size, color, letterSpacing: -size * 0.042, lineHeight: size * 1.05, marginLeft },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  word: { fontWeight: "500" },
  zeroBox: { alignItems: "center", justifyContent: "center" },
});
