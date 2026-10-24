// ../pub-game-store/native/ui/Icon.jsx
// reconstructed from the esbuild bundle in eboot.bin
// MODIFIED: settings, languages and info icons.

import { jsx } from 'react/jsx-runtime';
import { Path, Svg } from '@ps5-react/core';
import { useLocale } from '../i18n/index.js';
import { px } from './scale.js';

  var ring = (cx, cy, r) => `M${cx + r} ${cy}a${r} ${r} 0 1 1-${2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0`;
  var ICONS = {
    search: [ring(11, 11, 8), "m21 21-4.3-4.3"],
    // The header's tab icons (lucide 0.462, as the rest).
    compass: [ring(12, 12, 10), "m16.2 7.8-2.5 5.9-5.9 2.5 2.5-5.9 5.9-2.5Z"],
    controller: ["M6.8 8h10.4a4 4 0 0 1 3.8 2.8l1.1 5.3a2.8 2.8 0 0 1-4.5 2.8l-2.5-2.1H8.9l-2.5 2.1a2.8 2.8 0 0 1-4.5-2.8L3 10.8A4 4 0 0 1 6.8 8Z", "M8 11v4", "M6 13h4", "M16 12h.01", "M18 14h.01"],
    homebrew: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"],
    searchX: [ring(11, 11, 8), "m21 21-4.3-4.3", "m13.5 8.5-5 5", "m8.5 8.5 5 5"],
    chevronDown: ["m6 9 6 6 6-6"],
    chevronUp: ["m18 15-6-6-6 6"],
    chevronRight: ["m9 18 6-6-6-6"],
    chevronLeft: ["m15 18-6-6 6-6"],
    arrowLeft: ["m12 19-7-7 7-7", "M19 12H5"],
    arrowRight: ["m12 5 7 7-7 7", "M5 12h14"],
    heart: ["M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"],
    check: ["M20 6 9 17l-5-5"],
    x: ["M18 6 6 18", "m6 6 12 12"],
    download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
    play: ["M6 3 20 12 6 21Z"],
    pause: [
      "M7 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
      "M15 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
    ],
    circleCheck: [ring(12, 12, 10), "m9 12 2 2 4-4"],
    alert: [ring(12, 12, 10), "M12 8v4", "M12 16h.01"],
    // lucide 0.462 info, for the download row's game page.
    info: [ring(12, 12, 10), "M12 16v-4", "M12 8h.01"],
    restart: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
    trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
    list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
    external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
    star: ["M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"],
    delete: [
      "M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
      "m12 9 6 6",
      "m18 9-6 6"
    ],
    space: ["M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1"],
    globe: [ring(12, 12, 10), "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
    // lucide 0.462 "settings" and "languages", the set the rest of these come from.
    settings: [
      "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
      ring(12, 12, 3)
    ],
    languages: ["m5 8 6 6", "m4 14 6-6 2-3", "M2 5h12", "M7 2h1", "m22 22-5-10-5 10", "M14 18h6"],
    package: [
      "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
      "M12 22V12",
      "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7",
      "m7.5 4.27 9 5.15"
    ],
    disc: [ring(12, 12, 10), ring(12, 12, 2)],
    // lucide 0.462 cpu, lightbulb and file-minus, for the download tips.
    cpu: ["M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M10 9h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z", "M15 2v2", "M15 20v2", "M2 15h2", "M2 9h2", "M20 15h2", "M20 9h2", "M9 2v2", "M9 20v2"],
    lightbulb: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"],
    fileMinus: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M9 15h6"],
    archive: ["M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8", "M10 12h4"],
    folder: ["M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"],
    file: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4"],
    hardDrive: [
      "M22 12H2",
      "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
      "M6 16h.01",
      "M10 16h.01"
    ],
    layers: [
      "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
      "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",
      "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
    ]
  };
  var MIRRORED = { chevronLeft: "chevronRight", chevronRight: "chevronLeft", arrowLeft: "arrowRight" };
  // The download services' own marks (issues #89, #20): filled shapes in their own colours, as their
  // owners draw them, rather than the outline set above. TorBox's is torbox.app's own logo
  // (torbox.app/assets/logo-bb7a9579.svg); the torrent one is µTorrent's. Both are drawn at `size`,
  // in the box that fits their proportions.
  var BRANDS = {
    torbox: {
      viewBox: "367 308 766 884",
      paths: [
        { d: "M749.99 749.99 749.99 1191.96 367.25 970.97 367.25 529.01Z", fill: "#00444d" },
        { d: "M1132.75 529.01 1132.75 970.97 749.99 1191.96 749.99 749.99 872.87 679.05 956.71 630.66Z", fill: "#34ba90" },
        { d: "M1132.75 529.01 749.99 749.99 367.25 529.01 749.99 308.04Z", fill: "#52a153" },
        { d: "M1043.04 739.36 958.66 1057.08 952.4 851.84 839.71 915.39 872.87 679.05 956.71 630.66 931.81 799.21Z", fill: "#ffffff" }
      ]
    },
    utorrent: {
      viewBox: "0 0 241.046 240.081",
      paths: [
        { d: "m137.38383 239.99418c44.64832-6.2824 81.43169-37.04615 96.37094-78.28306-1.17843.43717-2.61663.95348-4.33344 1.46978-20.0859 5.93191-34.17804-4.68447-37.02056-6.51981-2.84253-1.81651-5.88835-4.82769-6.45686-4.6694-1.83729 11.38519-12.22849 27.19481-35.94756 34.36661-12.98901 3.93827-26.97196 4.02872-36.94903-1.56777l3.29055 8.26095c1.31773 3.29382 3.52774 8.69811 4.89817 11.97687 0 0 8.61793 20.53931 16.14779 34.96583", fill: "#76b83f", fillRule: "evenodd" },
        { d: "M27.337163 71.292153 62.88564 64.663041c3.237841-.591683 6.82582 1.247434 7.962829 4.085251l24.423106 61.011188c3.324434 6.36154 4.002122 7.76725 6.166955 10.48071 0 0 16.86313 24.09695 42.57008 18.21027 17.33374-3.96466 25.42834-16.98922 25.97802-26.25641.5685-2.97349-.32002-6.71579-1.86364-10.20936L138.86947 55.784027c-1.17465-2.668226.21837-5.28746 3.07219-5.833919l29.64506-5.528656c2.71828-.48616 5.90718 1.202209 7.09313 3.783756l32.401 69.437962c1.30643 2.77752 3.95318 7.15673 5.89964 9.70812 0 0 6.73923 9.68928 17.53705 7.85017 2.66934 0 5.7114-1.44718 5.7114-1.44718.47438-4.32267.72663-8.70565.72663-13.16023C240.95557 53.986366 187.01165 0 120.46273 0 53.932634 0 0 53.986366 0 120.59405c0 53.44744 34.739017 98.7583 82.851068 114.57923-3.249135-6.69318-6.53592-14.0911-9.227845-21.31567L23.067731 77.872271c-1.110654-2.984796.835815-5.935674 4.269432-6.580118", fill: "#76b83f", fillRule: "evenodd" }
      ]
    }
  };
  function Icon({ name, size = 16, color = "#f2f2f3", fill: fill2 = "none", strokeWidth = 2, fixed = false }) {
    const { rtl } = useLocale();
    const drawn = rtl && !fixed ? MIRRORED[name] ?? name : name;
    const brand = BRANDS[drawn];
    if (brand) {
      const boxWidth = Number(brand.viewBox.split(" ")[2]);
      const boxHeight = Number(brand.viewBox.split(" ")[3]);
      const width = boxWidth > boxHeight ? size : Math.round(size * boxWidth / boxHeight * 100) / 100;
      const height = boxWidth > boxHeight ? Math.round(size * boxHeight / boxWidth * 100) / 100 : size;
      return /* @__PURE__ */ (0, jsx)(Svg, { width: px(width), height: px(height), viewBox: brand.viewBox, children: brand.paths.map((path) => /* @__PURE__ */ (0, jsx)(
        Path,
        {
          d: path.d,
          fill: path.fill,
          stroke: "none",
          fillRule: path.fillRule
        },
        path.d
      )) });
    }
    return /* @__PURE__ */ (0, jsx)(Svg, { width: px(size), height: px(size), viewBox: "0 0 24 24", children: ICONS[drawn].map((d) => /* @__PURE__ */ (0, jsx)(
      Path,
      {
        d,
        fill: fill2,
        stroke: color,
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      },
      d
    )) });
  }

export { Icon };
