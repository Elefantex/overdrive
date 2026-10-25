// Where a PKG downloads, asked before it starts: in the background on the PS5, where its own Downloads
// fetch it and the console is free while it does (Overdrive can close), or in Overdrive as before,
// with pause, resume and the install at the end. "Remember" answers it for every PKG from then on;
// Settings can change that answer again (pkg-mode.js).

import '../assets/Inter-Regular.ttf';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { useNavActions } from '../state/nav.jsx';
import { setPkgMode } from '../state/pkg-mode.js';
import { formatBytes } from '../state/size.js';
import { Cover } from '../ui/Cover.jsx';
import { FocusRing } from '../ui/FocusRing.jsx';
import { Icon } from '../ui/Icon.jsx';
import { colors } from '../ui/colors.js';
import { FocusScope, Text, View } from '@ps5-react/core';

  var TEXT = { fontFamily: "Inter-Regular", color: colors.fg };

  function Option({ focusKey, icon, title, body, badge, onPress }) {
    return /* @__PURE__ */ (0, jsxs)(View, {
      focusKey, onPress,
      style: (state) => [{ position: "relative", flex: 1, gap: 16, borderRadius: 20, padding: 32, backgroundColor: colors.surface2 }, state.focused ? { backgroundColor: colors.surface3 } : null],
      children: [
        /* @__PURE__ */ (0, jsx)(FocusRing, {}),
        /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ (0, jsx)(View, { style: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.surface3 }, children: /* @__PURE__ */ (0, jsx)(Icon, { name: icon, size: 38, color: colors.fg }) }),
          badge ? /* @__PURE__ */ (0, jsx)(View, { style: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.ok }, children: /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 18, fontWeight: 600, color: colors.accentFg }, children: badge }) }) : null
        ] }),
        /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 30, fontWeight: 600, lineHeight: 38 }, children: title }),
        /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 21, color: colors.muted, lineHeight: 31 }, children: body })
      ]
    });
  }

  function StreamChoiceDialog({ game, release, submit, onClose }) {
    const t2 = useT();
    const [remember, setRemember] = (0, useState)(false);
    const { focusLater } = useNavActions();
    // As the tips dialog: a focus move still pending from the page would land under this one.
    (0, useEffect)(() => {
      focusLater("stream:console");
    }, []);
    const pick = (mode) => {
      if (remember) setPkgMode(mode === "here" ? "overdrive" : "console");
      onClose();
      submit(mode);
    };
    const size = release?.sizeBytes ? formatBytes(release.sizeBytes) : "";
    return /* @__PURE__ */ (0, jsx)(FocusScope, {
      trap: true, autoFocus: true,
      onBack: () => {
        onClose();
        return true;
      },
      onAction: () => true,
      children: /* @__PURE__ */ (0, jsx)(View, { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#000000d9" }, children: /* @__PURE__ */ (0, jsxs)(View, { style: { width: 1240, gap: 30, borderRadius: 24, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 56, paddingTop: 44, paddingBottom: 40 }, children: [
        /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", alignItems: "center", gap: 24 }, children: [
          /* @__PURE__ */ (0, jsx)(Cover, { game, label: false, style: { width: 84, height: 84, borderRadius: 12, overflow: "hidden" } }),
          /* @__PURE__ */ (0, jsxs)(View, { style: { flex: 1, gap: 4 }, children: [
            /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 40, fontWeight: 600, letterSpacing: -1, lineHeight: 48 }, children: t2("stream.title") }),
            /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 21, color: colors.muted, numberOfLines: 1, ellipsizeMode: "tail" }, children: [game.title, size].filter(Boolean).join(" \xB7 ") })
          ] })
        ] }),
        /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", gap: 24 }, children: [
          /* @__PURE__ */ (0, jsx)(Option, { focusKey: "stream:console", icon: "controller", title: t2("stream.console.title"), body: t2("stream.console.body"), badge: t2("stream.recommended"), onPress: () => pick("console") }),
          /* @__PURE__ */ (0, jsx)(Option, { focusKey: "stream:here", icon: "download", title: t2("stream.here.title"), body: t2("stream.here.body"), onPress: () => pick("here") })
        ] }),
        /* @__PURE__ */ (0, jsxs)(View, {
          focusKey: "stream:remember",
          onPress: () => setRemember(!remember),
          style: (state) => [{ position: "relative", flexDirection: "row", alignItems: "center", gap: 18, borderRadius: 14, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 12 }, state.focused ? { backgroundColor: colors.surface2 } : null],
          children: [
            /* @__PURE__ */ (0, jsx)(FocusRing, {}),
            /* @__PURE__ */ (0, jsx)(View, { style: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 2, borderColor: remember ? colors.fg : colors.subtle, backgroundColor: remember ? colors.fg : "transparent" }, children: remember ? /* @__PURE__ */ (0, jsx)(Icon, { name: "check", size: 22, color: colors.accentFg }) : null }),
            /* @__PURE__ */ (0, jsxs)(View, { style: { flex: 1, gap: 2 }, children: [
              /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 22, fontWeight: 600 }, children: t2("stream.remember") }),
              /* @__PURE__ */ (0, jsx)(Text, { style: { ...TEXT, fontSize: 19, color: colors.subtle }, children: t2("stream.rememberDetail") })
            ] })
          ]
        })
      ] }) })
    });
  }

export { StreamChoiceDialog };
