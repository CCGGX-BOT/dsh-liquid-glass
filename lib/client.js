/**
 * dsh-liquid-glass — Client half (browser bundle).
 *
 * A liquid-glass (frosted glassmorphism) theme for the DSH web UI:
 *   • translucent, blurred surfaces driven by theme-token overrides;
 *   • a custom background image (URL or local file → data URL), or a built-in
 *     gradient default;
 *   • a full settings page under 设置 / Settings → 液态玻璃;
 *   • preferences persist in localStorage of the browser.
 *
 * Bundle format: served verbatim by the client-modules route as
 * /plugins/dsh-liquid-glass/client.js; the kernel adopts this module as a
 * Cordis plugin. It requires only `react` (a static module of the shell).
 */
window.__ModuleLoader__.load({
  id: "dsh-liquid-glass",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    // ────────────────────────────── constants ──────────────────────────────

    /** localStorage key for persisted preferences. */
    const STORAGE_KEY = "dsh-liquid-glass.settings.v1";

    /** Fallback/preference defaults. */
    const DEFAULTS = Object.freeze({
      enabled: true,       // master switch
      background: "",      // image URL / data URL; "" = built-in gradient
      blur: 16,            // backdrop blur radius in px (0..40)
      opacity: 0.66,       // surface alpha (0.3..0.95)
      tint: "#0b1020",     // overlay tint color (hex)
      tintOpacity: 0.42    // overlay tint strength (0..0.8)
    });

    /** The stylesheet injected once per page load. */
    const LIQUID_GLASS_CSS = `
/* ============ dsh-liquid-glass ============ */
body[data-dsh-lg="on"] {
  background-color: var(--dsh-lg-tint, #0b1020);
  background-image: var(--dsh-lg-image, radial-gradient(1100px 700px at 15% 0%, rgba(96, 165, 250, 0.28), transparent 55%), radial-gradient(900px 700px at 95% 100%, rgba(99, 102, 241, 0.32), transparent 60%), linear-gradient(160deg, #101828 0%, #05060a 100%));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  min-height: 100vh;
}
/* readability scrim between the wallpaper and the translucent surfaces */
body[data-dsh-lg="on"]::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(var(--dsh-lg-tint-rgb, 11, 16, 32), var(--dsh-lg-tint-opacity, 0.42)), rgba(var(--dsh-lg-tint-rgb, 11, 16, 32), calc(var(--dsh-lg-tint-opacity, 0.42) * 0.55)));
}
/* frosted blur on the app frame (matched by its inline grid-template-columns) */
body[data-dsh-lg="on"] #root [style*="grid-template-columns"] {
  backdrop-filter: blur(var(--dsh-lg-blur, 16px)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 16px)) saturate(1.4);
}
/* portaled dialogs (settings panel, modals) get the same frost */
body[data-dsh-lg="on"] [role="dialog"] {
  backdrop-filter: blur(var(--dsh-lg-blur, 16px)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 16px)) saturate(1.4);
}
@media (prefers-reduced-motion: reduce) {
  body[data-dsh-lg="on"] { transition: none; }
}
`;

    // ─────────────────────────────── helpers ───────────────────────────────

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function toNumber(value, fallback) {
      if (value === null || value === undefined || value === "") return fallback;
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function toBoolean(value, fallback) {
      return typeof value === "boolean" ? value : fallback;
    }

    function toString(value, fallback) {
      return typeof value === "string" ? value : fallback;
    }

    /** "#rrggbb" → "r, g, b" string (for rgba() var interpolation). */
    function hexToRgb(hex, fallback) {
      const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
      if (!match) return fallback;
      const n = parseInt(match[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", ");
    }

    function isValidHex(hex) {
      return /^#?[0-9a-f]{6}$/i.test(String(hex || "").trim());
    }

    function loadSettings() {
      let raw = null;
      try {
        raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      } catch (_) {
        raw = null;
      }
      const tint = isValidHex(raw && raw.tint) ? String(raw.tint).trim() : DEFAULTS.tint;
      return {
        enabled: toBoolean(raw && raw.enabled, DEFAULTS.enabled),
        background: toString(raw && raw.background, DEFAULTS.background),
        blur: clamp(toNumber(raw && raw.blur, DEFAULTS.blur), 0, 40),
        opacity: clamp(toNumber(raw && raw.opacity, DEFAULTS.opacity), 0.3, 0.95),
        tint,
        tintOpacity: clamp(toNumber(raw && raw.tintOpacity, DEFAULTS.tintOpacity), 0, 0.8)
      };
    }

    function saveSettings(settings) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (_) {
        /* storage full/unavailable — painting still works for this page */
      }
    }

    /** Tiny external store for React.useSyncExternalStore. */
    function createStore(initial) {
      let value = { ...initial };
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(next) {
          value = { ...value, ...next };
          listeners.forEach((listener) => listener());
        }
      };
    }

    // ──────────────────────── theme token overrides ────────────────────────

    /**
     * Build the alias-token override layer: every large surface becomes a
     * translucent panel tinted by the active palette (light/dark pairs, as the
     * theme presenter requires). Values mirror design-platform.css.
     */
    function tokensFor(opacity) {
      const o = clamp(opacity, 0.3, 0.95);
      const oInput = clamp(opacity + 0.2, 0.5, 0.97);
      const oOverlay = clamp(opacity + 0.08, 0.4, 0.97);
      const oMenu = clamp(opacity + 0.15, 0.5, 0.97);
      return {
        "--dsw-alias-bg-base": { light: "rgba(255, 255, 255, " + o + ")", dark: "rgba(21, 21, 23, " + o + ")" },
        "--dsw-alias-bg-layer-1": { light: "rgba(255, 255, 255, " + o + ")", dark: "rgba(35, 35, 36, " + o + ")" },
        "--dsw-alias-bg-layer-2": { light: "rgba(255, 255, 255, " + o + ")", dark: "rgba(44, 44, 46, " + o + ")" },
        "--dsw-alias-bg-layer-3": { light: "rgba(255, 255, 255, " + o + ")", dark: "rgba(53, 54, 56, " + o + ")" },
        "--dsw-alias-bg-overlay": { light: "rgba(233, 236, 242, " + oOverlay + ")", dark: "rgba(97, 102, 107, " + oOverlay + ")" },
        "--dsw-alias-bg-module-platform": { light: "rgba(249, 250, 251, " + o + ")", dark: "rgba(53, 54, 56, " + o + ")" },
        "--dsw-specific-sidebar-fill": { light: "rgba(249, 250, 251, " + o + ")", dark: "rgba(27, 27, 28, " + o + ")" },
        "--dsw-specific-input-major": { light: "rgba(255, 255, 255, " + oInput + ")", dark: "rgba(44, 44, 46, " + oInput + ")" },
        "--dsw-specific-menu": { light: "rgba(255, 255, 255, " + oMenu + ")", dark: "rgba(53, 54, 56, " + oMenu + ")" }
      };
    }

    // ─────────────────────────────── painter ───────────────────────────────

    /**
     * Project the current settings onto the document: body attribute + CSS
     * custom properties, and the theme-service token override layer.
     */
    function createPainter(ctx) {
      let tokenDisposer = null;

      function paint(settings) {
        const body = document.body;
        if (body === null || body === undefined) return;
        if (settings.enabled) {
          body.setAttribute("data-dsh-lg", "on");
          body.style.setProperty("--dsh-lg-blur", String(settings.blur) + "px");
          body.style.setProperty("--dsh-lg-tint-rgb", hexToRgb(settings.tint, "11, 16, 32"));
          body.style.setProperty("--dsh-lg-tint-opacity", String(clamp(settings.tintOpacity, 0, 0.8)));
          const image = String(settings.background || "").trim();
          if (image !== "") {
            body.style.setProperty("--dsh-lg-image", 'url("' + image.replace(/"/g, "%22") + '")');
          } else {
            body.style.removeProperty("--dsh-lg-image");
          }
          // Replace the token layer in place (same source restacks on top).
          if (tokenDisposer) tokenDisposer();
          tokenDisposer = ctx.theme.overrideTokens("dsh-liquid-glass", tokensFor(settings.opacity));
        } else {
          body.removeAttribute("data-dsh-lg");
          body.style.removeProperty("--dsh-lg-blur");
          body.style.removeProperty("--dsh-lg-tint-rgb");
          body.style.removeProperty("--dsh-lg-tint-opacity");
          body.style.removeProperty("--dsh-lg-image");
          if (tokenDisposer) {
            tokenDisposer();
            tokenDisposer = null;
          }
        }
      }

      function dispose() {
        paint({ ...DEFAULTS, enabled: false });
      }

      return { paint, dispose };
    }

    // ─────────────────────────── settings UI (React) ───────────────────────

    const h = react.createElement;

    const rowStyle = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    };

    const labelStyle = {
      fontSize: 13,
      color: "var(--dsw-alias-label-primary)"
    };

    const hintStyle = {
      fontSize: 12,
      color: "var(--dsw-alias-label-tertiary)",
      lineHeight: "18px"
    };

    const groupStyle = {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: "14px 16px",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 12,
      background: "var(--dsw-alias-bg-layer-1)"
    };

    const inputStyle = {
      boxSizing: "border-box",
      width: "100%",
      padding: "8px 10px",
      fontSize: 13,
      color: "var(--dsw-alias-label-primary)",
      background: "var(--dsw-alias-bg-layer-2)",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 8,
      outline: "none",
      fontFamily: "inherit"
    };

    const rangeStyle = {
      flex: 1,
      accentColor: "var(--dsw-alias-brand-primary)"
    };

    /** One labeled slider row with a live value readout. */
    function RangeRow(props) {
      return h("div", { style: rowStyle },
        h("span", { style: labelStyle }, props.label),
        h("input", {
          type: "range",
          min: props.min,
          max: props.max,
          step: props.step || 1,
          value: props.value,
          style: rangeStyle,
          onChange: (event) => props.onChange(Number(event.target.value))
        }),
        h("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", minWidth: 44, textAlign: "right" } }, props.display)
      );
    }

    function CheckRow(props) {
      return h("label", { style: rowStyle },
        h("span", { style: labelStyle }, props.label),
        h("input", {
          type: "checkbox",
          checked: props.checked,
          onChange: (event) => props.onChange(event.target.checked)
        })
      );
    }

    /**
     * The settings page content. `props` are slot owner props; the store and
     * actions are closed over at registration time.
     */
    function LiquidGlassSection(props, store, actions) {
      const state = react.useSyncExternalStore(store.subscribe, store.getSnapshot);
      const fileRef = react.useRef(null);
      const hasImage = String(state.background || "").trim() !== "";

      const preview = hasImage
        ? h("img", {
            src: state.background,
            alt: "background preview",
            style: {
              width: "100%",
              maxHeight: 160,
              objectFit: "cover",
              borderRadius: 10,
              border: "1px solid var(--dsw-alias-border-l2)",
              display: "block"
            }
          })
        : h("div", {
            style: {
              width: "100%",
              height: 96,
              borderRadius: 10,
              border: "1px solid var(--dsw-alias-border-l2)",
              background: "radial-gradient(600px 300px at 20% 10%, rgba(96, 165, 250, 0.4), transparent 60%), linear-gradient(150deg, #1e293b, #0b1020)"
            }
          });

      const onPickFile = (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
          window.alert("图片太大（超过 10MB），请压缩后重试。\nImage too large (>10MB), please compress and retry.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") actions.update("background", result);
        };
        reader.readAsDataURL(file);
      };

      return h("div", { style: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, padding: "4px 2px 16px" } },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
          h("div", { style: { fontSize: 16, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, "液态玻璃 (Liquid Glass)"),
          h("div", { style: hintStyle }, "磨砂玻璃质感界面，背景支持自定义图片。偏好保存在本机浏览器中。")
        ),

        h("div", { style: groupStyle },
          CheckRow({ label: "启用液态玻璃效果", checked: state.enabled, onChange: (v) => actions.update("enabled", v) })
        ),

        h("div", { style: groupStyle },
          h("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, "背景图片"),
          preview,
          h("input", {
            type: "text",
            placeholder: "粘贴图片 URL（https://… 或 data:image/…），留空使用内置渐变",
            value: state.background,
            style: inputStyle,
            onChange: (event) => actions.update("background", event.target.value)
          }),
          h("div", { style: rowStyle },
            h("button", {
              type: "button",
              style: {
                ...inputStyle,
                width: "auto",
                cursor: "pointer",
                background: "var(--dsw-alias-button-floating-fill)",
                color: "var(--dsw-alias-label-primary)"
              },
              onClick: () => fileRef.current && fileRef.current.click()
            }, "选择本地图片"),
            h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: onPickFile }),
            h("button", {
              type: "button",
              style: { ...inputStyle, width: "auto", cursor: "pointer", background: "transparent", color: "var(--dsw-alias-label-secondary)" },
              onClick: () => actions.update("background", "")
            }, "清除")
          )
        ),

        h("div", { style: groupStyle },
          RangeRow({ label: "模糊强度", min: 0, max: 40, value: state.blur, display: state.blur + "px", onChange: (v) => actions.update("blur", v) }),
          RangeRow({ label: "表面不透明度", min: 0.3, max: 0.95, step: 0.01, value: state.opacity, display: Math.round(state.opacity * 100) + "%", onChange: (v) => actions.update("opacity", v) }),
          h("div", { style: rowStyle },
            h("span", { style: labelStyle }, "玻璃色调"),
            h("input", {
              type: "color",
              value: state.tint,
              style: { width: 56, height: 30, padding: 0, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 6, background: "transparent", cursor: "pointer" },
              onChange: (event) => actions.update("tint", event.target.value)
            })
          ),
          RangeRow({ label: "色调深度", min: 0, max: 0.8, step: 0.01, value: state.tintOpacity, display: Math.round(state.tintOpacity * 100) + "%", onChange: (v) => actions.update("tintOpacity", v) })
        ),

        h("div", { style: rowStyle },
          h("button", {
            type: "button",
            style: { ...inputStyle, width: "auto", cursor: "pointer", color: "var(--dsw-alias-state-warn-primary)", background: "transparent" },
            onClick: () => actions.reset()
          }, "恢复默认")
        )
      );
    }

    // ─────────────────────────────── plugin ────────────────────────────────

    const inject = ["slots", "theme"];

    function apply(ctx) {
      const settings = loadSettings();
      const store = createStore(settings);
      const painter = createPainter(ctx);

      const actions = {
        update(field, value) {
          const next = { ...loadSettings(), [field]: value };
          saveSettings(next);
          store.set(next);
          painter.paint(next);
        },
        reset() {
          const next = { ...DEFAULTS };
          saveSettings(next);
          store.set(next);
          painter.paint(next);
        }
      };

      // Stylesheet + initial paint, removed when the plugin is stopped.
      ctx.effect(() => {
        if (typeof document === "undefined") return;
        let tag = document.querySelector('style[data-plugin-css="dsh-liquid-glass"]');
        if (tag === null) {
          tag = document.createElement("style");
          tag.dataset.plugin = "dsh-liquid-glass";
          tag.dataset.pluginCss = "dsh-liquid-glass";
          tag.textContent = LIQUID_GLASS_CSS;
          document.head.appendChild(tag);
        }
        painter.paint(loadSettings());
        return () => {
          tag.remove();
          painter.dispose();
        };
      }, "dsh-liquid-glass: stylesheet + paint");

      // Settings page: 设置 / Settings → 液态玻璃.
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "liquid-glass",
        order: 60,
        label: () => "液态玻璃"
      }, (props) => LiquidGlassSection(props, store, actions)));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
