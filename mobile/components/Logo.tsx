import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/lib/theme-context";

interface LogoProps {
  size?: number;
}

// Static "askzero" wordmark rendered via a transparent WebView — the same exact
// mark as askzero_logo_animation_preview.html (two arcs, stroke 9, viewBox 52
// with overflow visible), but with no animation. Uses the browser engine so the
// "0" arcs render exactly and never clip (react-native-svg mangled them).
export function Logo({ size = 20 }: LogoProps) {
  const { scheme } = useTheme();
  const fg = scheme === "light" ? "#0a0a0a" : "#FFFFFF";
  const purple = scheme === "light" ? "#8B3FD6" : "#CB8AFF";

  const html = useMemo(() => {
    const fs = size;
    const zero = (fs * 52) / 72;
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:transparent;height:100%;overflow:visible;}
.wrap{display:flex;align-items:center;justify-content:flex-start;height:100vh;overflow:visible;}
.mark{display:flex;align-items:center;gap:0;}
.ask,.ero{font-family:-apple-system,system-ui,Roboto,sans-serif;font-size:${fs}px;font-weight:600;letter-spacing:${-fs * 0.04}px;color:${fg};line-height:1;}
.ero{margin-left:-2px;}
.zero-wrap{width:${zero}px;height:${fs}px;display:flex;align-items:center;justify-content:center;}
.zero-wrap svg{overflow:visible;}
</style></head>
<body><div class="wrap"><div class="mark">
<span class="ask">ask</span>
<span class="zero-wrap"><svg width="${zero}" height="${zero}" viewBox="-26 -26 52 52">
<path d="M 0,-22 A 22,22 0 1 1 15,-15" fill="none" stroke="${fg}" stroke-width="9" stroke-linecap="round"/>
<path d="M 15,-15 A 22,22 0 1 1 0,-22" fill="none" stroke="${purple}" stroke-width="9" stroke-linecap="round"/>
</svg></span>
<span class="ero">ero</span>
</div></div></body></html>`;
  }, [size, fg, purple]);

  return (
    <View
      style={{ width: size * 4.4, height: size * 1.7 }}
      pointerEvents="none"
      accessibilityLabel="askzero"
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: "transparent" }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        opaque={false}
        backgroundColor="transparent"
      />
    </View>
  );
}
