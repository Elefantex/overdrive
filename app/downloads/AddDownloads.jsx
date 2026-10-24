// The Downloads page's own section for downloads that do not come from the catalog (issues #107,
// #89, #20): a pasted link, a torrent through the user's own client or TorBox, and the setup for
// both services. A file that has to be fetched first (TorBox, qBittorrent) shows its progress in a
// dialog with Cancel; once the service names the file, it joins the normal queue, on the drive
// chosen in Settings.

import '../assets/Inter-Regular.ttf';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import { useNavActions } from '../state/nav.jsx';
import { downloadQueue, storageRoots } from '../state/downloads.js';
import { downloadRoot } from '../state/download-root.js';
import { qbittorrent as qbittorrentSettings, services as serviceSettings, setService, useServices } from '../state/download-services.js';
import { cancellation } from '../state/download-sources.js';
import { addLink, linkInput } from '../state/link-download.js';
import { createTorbox } from '../state/torbox.js';
import { createQBittorrent } from '../state/qbittorrent.js';
import { URLDialog } from './URLDialog.jsx';
import { primaryKey } from './DownloadRow.jsx';
import { Button2 } from '../ui/Button.jsx';
import { FocusRing } from '../ui/FocusRing.jsx';
import { Icon } from '../ui/Icon.jsx';
import { colors } from '../ui/colors.js';
import { FocusScope, Http, Text, View } from '@ps5-react/core';

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
  function AddCard({ icon, title, detail, onPress, focusKey, muted }) {
    return /* @__PURE__ */ (0, jsxs)(View, {
      focusKey, onPress,
      style: (state) => [CARD, state.focused ? { backgroundColor: colors.surface2 } : null],
      children: [
        /* @__PURE__ */ (0, jsx)(FocusRing, {}),
        /* @__PURE__ */ (0, jsx)(View, { style: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.surface2 }, children: /* @__PURE__ */ (0, jsx)(Icon, { name: icon, size: 26, color: muted ? colors.subtle : colors.fg }) }),
        /* @__PURE__ */ (0, jsxs)(View, { style: { flex: 1, gap: 4 }, children: [
          /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 24, fontWeight: 600, color: muted ? colors.muted : colors.fg, numberOfLines: 1 }, children: title }),
          /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 19, color: colors.muted, numberOfLines: 2, lineHeight: 26 }, children: detail })
        ] })
      ]
    });
  }

  // A wait with a bar: the service is fetching the file, or the client is still downloading it.
  function Waiting({ title, detail, progress, error: error2, onCancel, onClose }) {
    const t2 = useT();
    const percent = Math.max(0, Math.min(1, progress));
    return /* @__PURE__ */ (0, jsx)(FocusScope, {
      trap: true, autoFocus: true,
      onBack: () => {
        if (error2) onClose();
        else onCancel();
        return true;
      },
      children: /* @__PURE__ */ (0, jsx)(View, { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#000000f2" }, children: /* @__PURE__ */ (0, jsxs)(View, { style: { width: 900, gap: 26, borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, padding: 44 }, children: [
        /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 31, fontWeight: 600, color: colors.fg, lineHeight: 42 }, children: title }),
        /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 22, color: error2 ? colors.fg : colors.muted, lineHeight: 32 }, children: error2 || detail }),
        error2 ? null : /* @__PURE__ */ (0, jsxs)(View, { style: { gap: 12 }, children: [
          /* @__PURE__ */ (0, jsx)(View, { style: { width: 812, height: 8, borderRadius: 4, backgroundColor: colors.surface3 }, children: /* @__PURE__ */ (0, jsx)(View, { style: { width: Math.round(812 * percent), height: 8, borderRadius: 4, backgroundColor: colors.fg } }) }),
          /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 20, color: colors.muted }, children: t2("add.percent", { percent: String(Math.round(percent * 100)) }) })
        ] }),
        /* @__PURE__ */ (0, jsx)(View, { style: { flexDirection: "row", gap: 12 }, children: error2
          ? /* @__PURE__ */ (0, jsx)(Button2, { label: t2("add.close"), onPress: onClose, autoFocus: true })
          : /* @__PURE__ */ (0, jsx)(Button2, { label: t2("add.cancel"), variant: "outline", onPress: onCancel, autoFocus: true }) })
      ] }) })
    });
  }

  // The services' own settings: TorBox's key and the qBittorrent WebUI's address and login. They sit
  // beside the section that needs them rather than in Settings, since each user enters their own.
  function ServicesDialog({ onClose, onField }) {
    const t2 = useT();
    const services = useServices();
    const rows = [
      { field: "torbox", icon: "archive", title: t2("add.torboxKey"), value: services.torbox },
      { field: "address", icon: "globe", title: t2("add.address"), value: services.address },
      { field: "user", icon: "controller", title: t2("add.user"), value: services.user },
      { field: "password", icon: "controller", title: t2("add.password"), value: services.password ? "••••••••" : "" }
    ];
    return /* @__PURE__ */ (0, jsx)(FocusScope, {
      trap: true, autoFocus: true,
      onBack: () => {
        onClose();
        return true;
      },
      children: /* @__PURE__ */ (0, jsx)(View, { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#000000f2" }, children: /* @__PURE__ */ (0, jsxs)(View, { style: { width: 980, gap: 20, borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, padding: 44 }, children: [
        /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 34, fontWeight: 600, color: colors.fg }, children: t2("add.servicesTitle") }),
        /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 21, color: colors.muted, lineHeight: 30 }, children: t2("add.servicesDetail") }),
        rows.map((row) => /* @__PURE__ */ (0, jsxs)(View, {
          focusKey: `downloads:service:${row.field}`,
          onPress: () => onField(row.field),
          style: (state) => [{ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 12, paddingHorizontal: 16, height: 64, backgroundColor: colors.surface2 }, state.focused ? { backgroundColor: colors.surface3 } : null],
          children: [
            /* @__PURE__ */ (0, jsx)(FocusRing, {}),
            /* @__PURE__ */ (0, jsx)(Icon, { name: row.icon, size: 20, color: colors.muted }),
            /* @__PURE__ */ (0, jsx)(Text, { style: { flex: 1, fontFamily: "Inter-Regular", fontSize: 22, color: colors.fg }, children: row.title }),
            /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 20, color: row.value ? colors.fg : colors.subtle, numberOfLines: 1, ellipsizeMode: "head" }, children: row.value || t2("add.notSet") })
          ]
        }, row.field)),
        /* @__PURE__ */ (0, jsx)(View, { style: { flexDirection: "row", gap: 12, paddingTop: 4 }, children: /* @__PURE__ */ (0, jsx)(Button2, { label: t2("add.close"), variant: "outline", size: "sm", onPress: onClose }) })
      ] }) })
    });
  }

  // Picks the service a magnet goes to, when both are set up.
  function RouteDialog({ value, routes, onPick, onClose }) {
    const t2 = useT();
    const names = { torbox: t2("add.torboxName"), qbittorrent: t2("add.qbittorrentName") };
    return /* @__PURE__ */ (0, jsx)(FocusScope, {
      trap: true, autoFocus: true,
      onBack: () => {
        onClose();
        return true;
      },
      children: /* @__PURE__ */ (0, jsx)(View, { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#000000f2" }, children: /* @__PURE__ */ (0, jsxs)(View, { style: { width: 900, gap: 24, borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, padding: 44 }, children: [
        /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 32, fontWeight: 600, color: colors.fg }, children: t2("add.routeTitle") }),
        /* @__PURE__ */ (0, jsx)(Text, { style: { fontFamily: "Inter-Regular", fontSize: 21, color: colors.muted, numberOfLines: 2, ellipsizeMode: "middle", lineHeight: 30 }, children: value }),
        /* @__PURE__ */ (0, jsx)(View, { style: { flexDirection: "row", gap: 12 }, children: routes.map((route) => /* @__PURE__ */ (0, jsx)(Button2, {
          label: names[route], icon: route === "torbox" ? "archive" : "homebrew", size: "lg",
          focusKey: `downloads:route:${route}`, onPress: () => onPick(route)
        }, route)) }),
        /* @__PURE__ */ (0, jsx)(View, { style: { flexDirection: "row" }, children: /* @__PURE__ */ (0, jsx)(Button2, { label: t2("add.cancel"), variant: "outline", size: "sm", onPress: onClose }) })
      ] }) })
    });
  }

  // Hands the link to the service and waits; the file joins the queue as soon as it names one.
  function RunDialog({ route, value, onAdded, onClose }) {
    const t2 = useT();
    const [state, setState] = useState({ progress: 0, error: "" });
    const token = useRef(null);
    (0, useEffect)(() => {
      const cancel = cancellation();
      token.current = cancel;
      let live = true;
      const settings = serviceSettings();
      const progress = (report) => {
        if (live) setState((old) => ({ ...old, progress: report.progress }));
      };
      void (async () => {
        try {
          const prepared = route === "torbox"
            ? await createTorbox({ http: Http, key: settings.torbox }).prepare(value, { onProgress: progress, signal: cancel.signal })
            : await createQBittorrent({ http: Http, ...qbittorrentSettings() }).prepare(value, { onProgress: progress, signal: cancel.signal });
          if (!live) return;
          const id = addLink(downloadQueue(), { ...prepared, title: prepared.filename, root: chosenRoot() });
          live = false;
          onAdded(id);
        } catch (error2) {
          if (live) setState({ progress: 0, error: error2.message });
        }
      })();
      return () => {
        live = false;
        cancel.cancel();
      };
    }, [route, value]);

    const service = route === "torbox" ? t2("add.torboxName") : t2("add.qbittorrentName");
    return /* @__PURE__ */ (0, jsx)(Waiting, {
      title: t2("add.waitTitle", { service }),
      detail: t2("add.waitDetail", { service }),
      progress: state.progress,
      error: state.error,
      onCancel: () => {
        if (token.current) token.current.cancel();
        onClose();
      },
      onClose
    });
  }

  function AddDownloads({ onAdded }) {
    const t2 = useT();
    const services = useServices();
    const { focusLater } = useNavActions();
    const routes = [services.torbox ? "torbox" : null, services.address ? "qbittorrent" : null].filter(Boolean);
    const [dialog, setDialog] = useState(null);
    // { kind: "link" | "torrent" | "torbox" }, { kind: "route", value }, { kind: "run", route, value },
    // { kind: "services" }, { kind: "field", field, value }
    // The URL dialog closes itself once its submit returns, so a submit that opens the next dialog
    // says so here: that close must not wipe what it opened.
    const opening = useRef(false);
    const show = (value) => {
      opening.current = true;
      setDialog(value);
    };
    const close = () => {
      if (opening.current) {
        opening.current = false;
        return;
      }
      setDialog(null);
    };

    const add = (file) => {
      const id = addLink(downloadQueue(), { url: file.url, filename: file.filename, headers: file.headers, sizeBytes: file.sizeBytes, title: file.filename, root: chosenRoot() });
      if (onAdded) onAdded(id);
      else focusLater(primaryKey(id));
    };

    // A magnet pasted anywhere goes through a service: the queue cannot fetch one itself.
    const begin = (kind, value) => {
      const parsed = linkInput(value);
      if (kind !== "torrent" && parsed.kind === "magnet") kind = "torrent";
      if (kind === "torrent") {
        // A magnet is for either service; a file ending in .torrent is the client's own kind of
        // link, which TorBox has no call for.
        const torrent = /\.torrent(?:[?#]|$)/i.test(parsed.value);
        if (parsed.kind !== "magnet" && !torrent) throw new Error(t2("add.magnetOnly"));
        const usable = parsed.kind === "magnet" ? routes : routes.filter((route) => route === "qbittorrent");
        if (!usable.length) {
          if (routes.length) throw new Error(t2("add.torrentLinkNeedsClient"));
          show({ kind: "services" });
          return;
        }
        if (usable.length > 1) {
          show({ kind: "route", value: parsed.value, routes: usable });
          return;
        }
        show({ kind: "run", route: usable[0], value: parsed.value });
        return;
      }
      if (kind === "torbox") {
        if (/\.torrent(?:[?#]|$)/i.test(parsed.value) && parsed.kind !== "magnet") throw new Error(t2("add.torrentLinkNeedsClient"));
        if (!services.torbox) {
          show({ kind: "services" });
          return;
        }
        show({ kind: "run", route: "torbox", value: parsed.value });
        return;
      }
      // A plain link: the queue fetches it, through the host's own resolver when it knows the host.
      add({ url: parsed.value, filename: parsed.name });
    };

    const field = (name) => {
      const values = { torbox: services.torbox, address: services.address, user: services.user, password: services.password };
      setDialog({ kind: "field", field: name, value: values[name] || "" });
    };

    return /* @__PURE__ */ (0, jsxs)(Fragment, { children: [
      /* @__PURE__ */ (0, jsxs)(View, { style: { paddingHorizontal: 48, paddingBottom: 30, gap: 14 }, children: [
        /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", alignItems: "center", gap: 12 }, children: [
          /* @__PURE__ */ (0, jsx)(Text, { style: { flex: 1, fontFamily: "Inter-Regular", fontSize: 20, fontWeight: 600, color: colors.subtle, letterSpacing: 1 }, children: t2("add.title") }),
          /* @__PURE__ */ (0, jsx)(Button2, { label: t2("add.setup"), icon: "settings", variant: "ghost", size: "sm", focusKey: "downloads:add:setup", onPress: () => setDialog({ kind: "services" }) })
        ] }),
        /* @__PURE__ */ (0, jsxs)(View, { style: { flexDirection: "row", gap: 14 }, children: [
          /* @__PURE__ */ (0, jsx)(AddCard, { icon: "globe", title: t2("add.link"), detail: t2("add.linkDetail"), focusKey: "downloads:add:link", onPress: () => setDialog({ kind: "link" }) }),
          /* @__PURE__ */ (0, jsx)(AddCard, { icon: "layers", title: t2("add.torrent"), detail: routes.length ? t2("add.torrentDetail") : t2("add.torrentSetup"), focusKey: "downloads:add:torrent", muted: !routes.length, onPress: () => setDialog({ kind: "torrent" }) }),
          /* @__PURE__ */ (0, jsx)(AddCard, { icon: "archive", title: t2("add.torbox"), detail: services.torbox ? t2("add.torboxDetail") : t2("add.torboxSetup"), focusKey: "downloads:add:torbox", muted: !services.torbox, onPress: () => setDialog({ kind: "torbox" }) })
        ] })
      ] }),
      dialog && dialog.kind === "link" ? /* @__PURE__ */ (0, jsx)(URLDialog, {
        title: t2("add.linkTitle"), detail: t2("add.linkBody"), initial: "",
        submit: (value) => begin("link", value), onClose: close
      }) : null,
      dialog && dialog.kind === "torrent" ? /* @__PURE__ */ (0, jsx)(URLDialog, {
        title: t2("add.torrentTitle"), detail: t2("add.torrentBody"), initial: "magnet:?xt=urn:btih:",
        submit: (value) => begin("torrent", value), onClose: close
      }) : null,
      dialog && dialog.kind === "torbox" ? /* @__PURE__ */ (0, jsx)(URLDialog, {
        title: t2("add.torboxTitle"), detail: t2("add.torboxBody"), initial: "",
        submit: (value) => begin("torbox", value), onClose: close
      }) : null,
      dialog && dialog.kind === "field" ? /* @__PURE__ */ (0, jsx)(URLDialog, {
        title: t2(`add.field.${dialog.field}`), detail: t2(`add.fieldBody.${dialog.field}`), initial: dialog.value,
        // This dialog's own close already goes back to the list of settings, so it needs no flag.
        submit: (value) => {
          setService(dialog.field, value);
          setDialog({ kind: "services" });
        },
        onClose: () => setDialog({ kind: "services" })
      }) : null,
      dialog && dialog.kind === "services" ? /* @__PURE__ */ (0, jsx)(ServicesDialog, { onClose: () => setDialog(null), onField: field }) : null,
      dialog && dialog.kind === "route" ? /* @__PURE__ */ (0, jsx)(RouteDialog, {
        value: dialog.value, routes: dialog.routes ?? routes,
        onPick: (route) => setDialog({ kind: "run", route, value: dialog.value }),
        onClose: () => setDialog(null)
      }) : null,
      dialog && dialog.kind === "run" ? /* @__PURE__ */ (0, jsx)(RunDialog, {
        route: dialog.route, value: dialog.value,
        onAdded: (id) => {
          setDialog(null);
          focusLater(primaryKey(id));
        },
        onClose: () => setDialog(null)
      }) : null
    ] });
  }

export { AddDownloads };
