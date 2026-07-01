import { useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { LogoIntro } from "@/components/LogoIntro";
import { colors } from "@/lib/theme";

// The intro animation finishes drawing the arcs at ~1.5s; hold a touch longer
// so the completed mark rests briefly before routing.
const MIN_SPLASH_MS = 2100;

export default function Splash() {
  const { session, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  const tagline = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(tagline, {
      toValue: 1,
      duration: 800,
      delay: 1200, // fade the tagline in after the mark has drawn
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [tagline]);

  // Hold the splash until BOTH the auth check resolves and the minimum
  // animation time has elapsed, then route.
  if (minElapsed && !loading) {
    return <Redirect href={session ? "/chat" : "/login"} />;
  }

  return (
    <View style={styles.container}>
      <LogoIntro size={56} />
      <Animated.Text style={[styles.tagline, { opacity: tagline }]}>
        private, verifiable AI.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
});
