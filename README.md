# 句间 Jvjian · 微信读书网页版单栏长页

**Jvjian · WeRead Layout** is an independent browser extension for the WeRead web reader. It adds single-column scrolling pages, adjustable typography and local wallpapers while retaining WeRead's original highlights and reader comments.

句间让微信读书网页版在居中的单栏长页中上下滚动，并保留原生划线和书友想法。适用于 Edge 和 Chrome，与腾讯无官方关联。每个长页默认容纳约 6 个普通单栏页，读到页底后点击微信读书的「下一页」。图片、章节结尾和原书分页会影响实际字数。

[在 Edge 扩展商店安装句间](https://microsoftedge.microsoft.com/addons/detail/jvjian/cpbbonhahofomaiomlblhoghdjpgcmpb)

右下角的「句间」按钮和浏览器工具栏弹窗都能调整排版。「每个长页约含」可选择 1 到 8 个普通页，选择 1 可恢复单屏分页。默认开启「使用滚动模式的行宽」。关闭后可使用居中的固定页宽，并沿用旧版保存的宽度。

启用句间布局后，可以分别调整正文字体、字号、行距和文字颜色。字体选项包括黑体、宋体、楷体、思源黑体、思源宋体和仿宋等，实际显示取决于设备安装的字体。自定字号时，默认行距约为字号的 1.9 倍。

展开「阅读背景」，可选暖黄、豆绿、浅蓝、浅粉或自选颜色。外侧默认跟随正文底色并减弱色调，也可保持原生背景或单独选色。「本地壁纸」支持选择 25 MB 以内的图片，可完整显示或铺满裁切，并调整横向位置、纵向位置和不透明度。图片缩放压缩后保存在当前浏览器，选择「移除壁纸」可以清除它。

## 手动安装

1. 在 [GitHub Releases](https://github.com/lione12138/Jvjian/releases/latest) 下载 `Jvjian-版本号.zip` 并解压。
2. 在 Edge 打开 `edge://extensions`，开启「开发人员模式」，点击「加载解压缩的扩展」。
3. 选择包含 `manifest.json` 的解压目录，再刷新微信读书阅读页。

开发时也可以加载本仓库目录。更新本地开发版后，在扩展管理页重新加载扩展，再刷新阅读页。

扩展只保存本地排版设置，并使用网页自带的讨论面板。详见[隐私说明](PRIVACY.md)。

## 已验证的范围

本地 Chromium 测试覆盖不同窗口宽度下的正文绘制、向下滚动、点击划线和还原布局。登录 Edge 的《置身事内：中国政府与经济发展》页面上一次实测的是 0.3.0 的单屏单栏和虚线点击。

运行布局回归检查：

~~~sh
node --test tests/native-layout.cjs
# 安装 Playwright 和 Chromium 后运行浏览器排版测试
node --test tests/long-page-browser.cjs
~~~

## 许可证

[MIT](LICENSE)
