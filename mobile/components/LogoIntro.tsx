import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/lib/theme-context";

// Renders the EXACT mark + animation from askzero_logo_animation_preview.html in
// a transparent WebView. Using the browser engine gives real `overflow: visible`
// and spec-correct SVG arcs, so the loop never clips (unlike react-native-svg).
export function LogoIntro({
  size = 56,
  onDone,
}: {
  size?: number;
  onDone?: () => void;
}) {
  const { scheme } = useTheme();
  const fg = scheme === "light" ? "#000000" : "#FEFEFE";
  const purple = scheme === "light" ? "#B75FFF" : "#CB8AFF";

  const html = useMemo(() => {
    const fs = size;
    const zero = (fs * 52) / 72; // svg px, matching the preview's 52px @ 72px font
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:transparent;height:100%;overflow:visible;}
.wrap{display:flex;align-items:center;justify-content:center;height:100vh;overflow:visible;}
@keyframes askIn{from{opacity:0;transform:translateX(-${fs}px);}to{opacity:1;transform:translateX(0);}}
@keyframes eroIn{from{opacity:0;transform:translateX(${fs}px);}to{opacity:1;transform:translateX(0);}}
@keyframes zeroIn{0%{opacity:0;transform:scale(0.2) rotate(-90deg);}60%{opacity:1;}100%{opacity:1;transform:scale(1) rotate(0deg);}}
@keyframes drawBlack{from{stroke-dashoffset:120;}to{stroke-dashoffset:0;}}
@keyframes drawPurple{from{stroke-dashoffset:120;}to{stroke-dashoffset:0;}}
.mark{display:flex;align-items:center;gap:0;}
.ask,.ero{font-family:-apple-system,system-ui,Roboto,sans-serif;font-size:${fs}px;font-weight:600;letter-spacing:${-fs * 0.04}px;color:${fg};line-height:1;}
.ask{animation:askIn .7s cubic-bezier(.2,.8,.2,1) .1s both;}
.ero{margin-left:-2px;animation:eroIn .7s cubic-bezier(.2,.8,.2,1) .1s both;}
.zero-wrap{width:${zero}px;height:${fs}px;display:flex;align-items:center;justify-content:center;animation:zeroIn .8s cubic-bezier(.2,.8,.2,1) .5s both;}
.zero-wrap svg{overflow:visible;}
.zero-black,.zero-purple{stroke-dasharray:120;stroke-dashoffset:120;}
.zero-black{animation:drawBlack .6s ease-out .7s forwards;}
.zero-purple{animation:drawPurple .6s ease-out .9s forwards;}
</style></head>
<body><div class="wrap"><div class="mark">
<span class="ask">ask</span>
<span class="zero-wrap"><svg width="${zero}" height="${zero}" viewBox="-26 -26 52 52">
<path class="zero-black" d="M 0,-22 A 22,22 0 1 1 15,-15" fill="none" stroke="${fg}" stroke-width="9" stroke-linecap="round"/>
<path class="zero-purple" d="M 15,-15 A 22,22 0 1 1 0,-22" fill="none" stroke="${purple}" stroke-width="9" stroke-linecap="round"/>
</svg></span>
<span class="ero">ero</span>
</div></div></body></html>`;
  }, [size, fg, purple]);

  useEffect(() => {
    // The animation finishes drawing the arcs at ~1.5s.
    const t = setTimeout(() => onDone?.(), 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={{ width: size * 5, height: size * 2 }} pointerEvents="none">
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: "transparent" }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        // let the splash background show through
        opaque={false}
        backgroundColor="transparent"
      />
    </View>
  );
}
