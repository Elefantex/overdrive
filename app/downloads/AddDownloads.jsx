// The Downloads page's own section for downloads that do not come from the catalog (issues #107,
// #89, #20): a pasted link, and a torrent — a magnet or a ".torrent" link — that the app's own
// engine fetches. Both join the normal queue on the drive chosen in Settings, and pause, resume,
// install and delete like a catalog download.
//
// The strip scrolls with the list, so it is the screen that places it (useAddDownloads returns it
// beside the dialogs): a fixed strip above the list took the focus with it when the list scrolled.

import '../assets/Inter-Regular.ttf';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { useT } from '../i18n/index.js';
import { useNavActions } from '../state/nav.jsx';
import { downloadQueue, storageRoots } from '../state/downloads.js';
import { downloadRoot } from '../state/download-root.js';
import { addLink, addTorrent, linkInput } from '../state/link-download.js';
import { URLDialog } from './URLDialog.jsx';
import { primaryKey } from './DownloadRow.jsx';
import { FocusRing } from '../ui/FocusRing.jsx';
import { Icon } from '../ui/Icon.jsx';
import { colors } from '../ui/colors.js';
import { Text, View } from '@ps5-react/core';

  // Where a pasted file is saved: the drive chosen in Settings, when it is still there.
  function chosenRoot() {
    try {
      const roots = storageRoots();
      const remembered = downloadRoot();
      return remembered && roots.includes(remembered) ? remembered : roots[0] ?? "/data";
    } catch {
      return "/data";
    }
  }

  var CARD = { width: 430, height: 124, flexDirection: "row", alignItems: "center", gap: 18, borderRadius: 16, paddingHorizontal: 20, backgroundColor: colors.surface };
  function AddCard({ icon, title, detail, onPress, focusKey, nextFocusDown }) {
    return /* @__PURE__ */ (0, jsxs)(View, {
      focusKey, onPress, nextFocusDown,
      style: (state) => [CARD, state.focused ? { backgroundColor: colors.surface2 } : null],
      children: [
        /* @__PURE__ */ (0, jsx)(FocusRing, {}),
        /* @__PURE__ */ (0, jsx)(View, { style: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.surface2 }, children: /* @__PURE__ */ (0, jsx)(Icon, { name: icon, size: 30, color: colors.fg }) }),
        /* @__PURE__ */ (0, jsxs)(View, { style: { flex: 1, gap: 4 }, children: [
          /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 24, fontWeight: 600, color: colors.fg, numberOfLines: 1 }, children: title }),
          /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 19, color: colors.muted, numberOfLines: 2, lineHeight: 26 }, children: detail })
        ] })
      ]
    });
  }

  var TORRENT_FILE = /\.torrent(?:[?#]|$)/i;

  // The strip and its dialogs. The strip belongs in the page's list, where it scrolls with it, and
  // the dialogs above everything: the screen asks for both.
  function useAddDownloads({ onAdded, down } = {}) {
    const t2 = useT();
    const { focusLater } = useNavActions();
    const [dialog, setDialog] = useState(null);
    // { kind: "link" | "torrent" }
    // A URL dialog closes itself once its submit returns; this leaves a dialog opened by a submit
    // alone, should there ever be one.
    const closeIf = (kind) => setDialog((current) => current && current.kind === kind ? null : current);

    const added = (id) => {
      if (onAdded) onAdded(id);
      else focusLater(primaryKey(id));
    };

    // A pasted value goes to the queue: a magnet or a ".torrent" link to the engine, anything else
    // as a direct file. The link card takes a torrent pasted in it too, rather than downloading it
    // as a file of its own.
    const open = (kind, value) => {
      const parsed = linkInput(value);
      const torrent = parsed.kind === "magnet" || TORRENT_FILE.test(parsed.value);
      if (torrent) {
        const magnet = parsed.kind === "magnet" ? parsed.value : void 0;
        added(addTorrent(downloadQueue(), { magnet, url: magnet ? void 0 : parsed.value, root: chosenRoot() }));
        return;
      }
      if (kind === "torrent") throw new Error(t2("add.magnetOnly"));
      added(addLink(downloadQueue(), { url: parsed.value, filename: parsed.name, title: parsed.name, root: chosenRoot() }));
    };

    const strip = /* @__PURE__ */ (0, jsxs)(View, { style: { gap: 14 }, children: [
      /* @__PURE__ */ (0, jsx)(Text, { style: { paddingHorizontal: 6, fontFamily: "Inter-Regular", fontSize: 20, fontWeight: 600, color: colors.subtle, letterSpacing: 1 }, children: t2("add.title") }),
      // The focus ring is drawn 7 px outside the card, and the scroll view clips what it has no room
      // for: the first card sat flush with its left edge, so the ring was cut and looked broken.
      // Down goes to the first row of the list, which the D-pad used to pass over for the panel on the
      // right: it was the nearer thing below, not the one the player meant (2026-10-25).
      /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", gap: 14, paddingLeft: 12 }, children: [
        /* @__PURE__ */ (0, jsx)(AddCard, { icon: "link", title: t2("add.link"), detail: t2("add.linkDetail"), focusKey: "downloads:add:link", nextFocusDown: down, onPress: () => setDialog({ kind: "link" }) }),
        /* @__PURE__ */ (0, jsx)(AddCard, { icon: "download", title: t2("add.torrent"), detail: t2("add.torrentDetail"), focusKey: "downloads:add:torrent", nextFocusDown: down, onPress: () => setDialog({ kind: "torrent" }) })
      ] })
    ] });

    const dialogs = /* @__PURE__ */ (0, jsxs)(Fragment, { children: [
      dialog && dialog.kind === "link" ? /* @__PURE__ */ (0, jsx)(URLDialog, {
        title: t2("add.linkTitle"), detail: t2("add.linkBody"), initial: "",
        submit: (value) => open("link", value), onClose: () => closeIf("link")
      }) : null,
      dialog && dialog.kind === "torrent" ? /* @__PURE__ */ (0, jsx)(URLDialog, {
        title: t2("add.torrentTitle"), detail: t2("add.torrentBody"), initial: "magnet:?xt=urn:btih:",
        submit: (value) => open("torrent", value), onClose: () => closeIf("torrent")
      }) : null
    ] });

    return { strip, dialogs };
  }

export { useAddDownloads };
