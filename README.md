# dsh-liquid-glass

Liquid-glass (glassmorphism) theme plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) **web UI**, with **custom background image** support.

液态玻璃（磨砂玻璃）主题插件，用于 DSH 网页端，支持自定义背景图片。

![license](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features / 特性

- **Liquid glass look** — every major surface (sidebar, chat column, details panel, input dock, dialogs) becomes a translucent frosted panel with backdrop blur, driven by the theme's own token system (works with both light and dark palettes).
- **Custom background** — paste any image URL (`https://…`), or pick a local image (auto-converted to a data URL, ≤ 10 MB).
- **Built-in gradient** — no image configured? A soft aurora gradient is used.
- **Tunable** — blur strength, surface opacity, tint color and tint depth, on/off master switch, one-click reset.
- **Persisted locally** — preferences are kept in the browser's `localStorage`; no server state.
- **Safe to remove** — stopping the plugin removes its styles, token overrides and DOM attributes.

## 📦 Install / 安装

The plugin is a normal DSH web-profile plugin. From the directory where you normally run `dsh`:

```bash
# 1. add the dependency into the web profile
dsh plugin --profile web add https://github.com/CCGGX-BOT/dsh-liquid-glass.git

# 2. register the row in the profile patch (once)
#    append to ~/.dsh/profiles/web/cordis.patch.yml:
#
#    - insert:
#        - id: liquid-glass
#          name: dsh-liquid-glass

# 3. restart the web app
dsh web
```

Then open the web UI → 设置 / Settings → **液态玻璃**.

> Requires `pnpm` on your PATH (used by `dsh plugin`).

## 🔧 Usage / 使用

| Control | Effect |
| --- | --- |
| 启用液态玻璃效果 | master on/off |
| 背景图片 | image URL or local file (≤ 10 MB) |
| 模糊强度 | backdrop blur radius, 0–40 px |
| 表面不透明度 | surface alpha, 30–95 % |
| 玻璃色调 / 色调深度 | overlay tint color & strength |
| 恢复默认 | reset all to defaults |

## 🛠 Development / 开发

```
dsh-liquid-glass/
├── package.json      # dsh.client → web bundle declaration
├── lib/
│   ├── index.js      # host half (no-op; loader entry)
│   └── client.js     # browser bundle: CSS, painter, settings UI
└── README.md
```

The client bundle is plain JavaScript in the kernel's `window.__ModuleLoader__.load({ id, factory })` format and only depends on the shell's static `react` module — no build step required.

## 📄 License

[MIT](LICENSE)
