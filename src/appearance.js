'use strict';

const jujianAppearance = (() => {
  const presets = { amber: '#f2d375', green: '#a9d7ac', blue: '#a9cce8', rose: '#edbec6' };
  const defaults = {
    readerBackground: 'native',
    readerCustomColor: '#f2d375',
    readerWallpaper: '',
    readerWallpaperOpacity: 20,
    readerWallpaperFit: 'contain',
    readerWallpaperX: 50,
    readerWallpaperY: 50,
    readerOuterBackground: 'follow',
    readerOuterColor: '#a9d7ac',
    readerTextColor: '',
  };
  const wallpaperPattern = /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/;
  const markup = `<details class="jujian-appearance">
    <summary>阅读背景</summary>
    <label>背景<select id="reader-background">
      <option value="native">跟随微信读书</option><option value="amber">暖黄</option>
      <option value="green">豆绿</option><option value="blue">浅蓝</option>
      <option value="rose">浅粉</option><option value="custom">自选颜色</option>
      <option value="wallpaper">本地壁纸</option>
    </select></label>
    <label id="background-color-row" hidden>自选颜色<input id="reader-background-color" type="color"></label>
    <div id="wallpaper-options" hidden>
      <label for="reader-wallpaper">选择本地图片</label>
      <input id="reader-wallpaper" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif">
      <label>图片显示方式<select id="reader-wallpaper-fit">
        <option value="contain">完整显示</option>
        <option value="cover">铺满裁切</option>
      </select></label>
      <label for="reader-wallpaper-x">横向位置 <output id="wallpaper-x-value">50%</output></label>
      <input id="reader-wallpaper-x" type="range" min="0" max="100" value="50">
      <label for="reader-wallpaper-y">纵向位置 <output id="wallpaper-y-value">50%</output></label>
      <input id="reader-wallpaper-y" type="range" min="0" max="100" value="50">
      <p class="hint">竖图可选「完整显示」。想铺满并保留某一部分，切到「铺满裁切」后调整位置。</p>
      <label for="reader-wallpaper-opacity">壁纸不透明度 <output id="wallpaper-opacity-value">20%</output></label>
      <input id="reader-wallpaper-opacity" type="range" min="0" max="100" step="1" value="20">
      <button id="reader-wallpaper-remove" type="button">移除壁纸</button>
    </div>
    <label>外侧背景<select id="reader-outer-background">
      <option value="follow">跟随正文底色（更淡）</option>
      <option value="native">跟随微信读书</option>
      <option value="custom">单独选颜色</option>
    </select></label>
    <label id="outer-color-row" hidden>外侧颜色<input id="reader-outer-color" type="color"></label>
    <p id="appearance-status" role="status" hidden></p>
  </details>`;
  const textColorMarkup = `<label>自定义文字颜色<input id="reader-text-color-enabled" type="checkbox" style="width:auto"></label>
    <label id="text-color-row" hidden>正文颜色<input id="reader-text-color" type="color" value="#353535"></label>`;

  function normalize(values) {
    const { readerBackground, readerCustomColor, readerWallpaper, readerWallpaperOpacity,
      readerWallpaperFit, readerWallpaperX, readerWallpaperY, readerOuterBackground,
      readerOuterColor, readerTextColor } = values;
    const percent = (value, fallback) => Number.isInteger(value) ? Math.min(100, Math.max(0, value)) : fallback;
    const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    return {
      readerBackground: ['native','custom','wallpaper'].includes(readerBackground) || Object.hasOwn(presets, readerBackground)
        ? readerBackground : defaults.readerBackground,
      readerCustomColor: color(readerCustomColor, defaults.readerCustomColor),
      readerWallpaper: typeof readerWallpaper === 'string' && readerWallpaper.length <= 4_000_000 && wallpaperPattern.test(readerWallpaper)
        ? readerWallpaper : '',
      readerWallpaperOpacity: percent(readerWallpaperOpacity, defaults.readerWallpaperOpacity),
      readerWallpaperFit: readerWallpaperFit === 'cover' ? 'cover' : 'contain',
      readerWallpaperX: percent(readerWallpaperX, defaults.readerWallpaperX),
      readerWallpaperY: percent(readerWallpaperY, defaults.readerWallpaperY),
      readerOuterBackground: ['follow','native','custom'].includes(readerOuterBackground)
        ? readerOuterBackground : defaults.readerOuterBackground,
      readerOuterColor: color(readerOuterColor, defaults.readerOuterColor),
      readerTextColor: color(readerTextColor, ''),
    };
  }

  async function encodeWallpaper(file) {
    if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) {
      throw new Error('请选择 25 MB 以内的图片。');
    }
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/webp', 0.82);
      if (image.length > 4_000_000 || !wallpaperPattern.test(image)) throw new Error('无法保存这张图片。');
      return image;
    } finally {
      bitmap.close();
    }
  }

  function connect(root, save) {
    const byId = id => root.getElementById(id);
    const mode = byId('reader-background');
    const color = byId('reader-background-color');
    const file = byId('reader-wallpaper');
    const fit = byId('reader-wallpaper-fit');
    const outer = byId('reader-outer-background');
    const outerColor = byId('reader-outer-color');
    const textEnabled = byId('reader-text-color-enabled');
    const textColor = byId('reader-text-color');
    const sliders = [
      ['opacity', 'readerWallpaperOpacity'],
      ['x', 'readerWallpaperX'],
      ['y', 'readerWallpaperY'],
    ].map(([id, key]) => ({
      key,
      input: byId(`reader-wallpaper-${id}`),
      output: byId(`wallpaper-${id}-value`),
    }));
    const remove = byId('reader-wallpaper-remove');
    const status = byId('appearance-status');
    let hasWallpaper = false;
    const show = message => {
      status.hidden = false;
      status.textContent = message;
    };
    const refresh = () => {
      byId('background-color-row').hidden = mode.value !== 'custom';
      byId('wallpaper-options').hidden = mode.value !== 'wallpaper';
      byId('outer-color-row').hidden = outer.value !== 'custom';
      byId('text-color-row').hidden = !textEnabled.checked;
      for (const {input, output} of sliders) output.textContent = `${input.value}%`;
    };
    const persist = async changes => {
      try {
        await save(changes);
        status.hidden = true;
      } catch {
        show('背景设置保存失败，请重试。');
      }
    };
    mode.addEventListener('change', () => {
      refresh();
      void persist({readerBackground: mode.value});
    });
    color.addEventListener('change', () => persist({readerCustomColor: color.value}));
    outer.addEventListener('change', () => {
      refresh();
      void persist({readerOuterBackground: outer.value});
    });
    outerColor.addEventListener('change', () => persist({readerOuterColor: outerColor.value}));
    textEnabled.addEventListener('change', () => {
      refresh();
      void persist({readerTextColor: textEnabled.checked ? textColor.value : ''});
    });
    textColor.addEventListener('change', () => persist({readerTextColor: textColor.value}));
    fit.addEventListener('change', () => persist({readerWallpaperFit: fit.value}));
    for (const {key, input} of sliders) {
      input.addEventListener('input', refresh);
      input.addEventListener('change', () => persist({[key]: Number(input.value)}));
    }
    file.addEventListener('change', async () => {
      const selected = file.files[0];
      if (!selected) return;
      file.disabled = true;
      remove.disabled = true;
      show('正在处理图片…');
      try {
        const image = await encodeWallpaper(selected);
        await save({readerWallpaper: image});
        status.hidden = true;
      } catch {
        show('图片无法读取或保存。请换一张 25 MB 以内的图片。');
      } finally {
        file.value = '';
        file.disabled = false;
        remove.disabled = !hasWallpaper;
      }
    });
    remove.addEventListener('click', () => persist({readerWallpaper: ''}));
    return settings => {
      const values = normalize(settings);
      mode.value = values.readerBackground;
      color.value = values.readerCustomColor;
      fit.value = values.readerWallpaperFit;
      outer.value = values.readerOuterBackground;
      outerColor.value = values.readerOuterColor;
      textEnabled.checked = Boolean(values.readerTextColor);
      if (values.readerTextColor) textColor.value = values.readerTextColor;
      for (const {key, input} of sliders) input.value = String(values[key]);
      hasWallpaper = Boolean(values.readerWallpaper);
      remove.disabled = !hasWallpaper || file.disabled;
      refresh();
    };
  }

  function paperStyles(values, ratio) {
    const {readerBackground, readerCustomColor, readerWallpaper, readerWallpaperOpacity,
      readerWallpaperFit, readerWallpaperX, readerWallpaperY} = values;
    if (readerBackground === 'native') return '';
    if (readerBackground === 'wallpaper') {
      if (!readerWallpaper || !(ratio > 0)) return '';
      const tint = `color-mix(in srgb,var(--jujian-paper-base) ${100 - readerWallpaperOpacity}%,transparent)`;
      // A fixed CSS background uses the whole viewport as its positioning area.
      // Size and offset the second layer against the visible sheet instead.
      const fit = readerWallpaperFit === 'cover' ? 'max' : 'min';
      const width = 'var(--jujian-sheet-width)';
      const height = 'var(--jujian-wallpaper-height)';
      const imageHeight = `${fit}(${height},calc(${width} / ${ratio}))`;
      const imageWidth = `calc(${imageHeight} * ${ratio})`;
      const x = `calc((var(--jujian-viewport-width) - ${width}) / 2 + (${width} - ${imageWidth}) * ${readerWallpaperX / 100})`;
      const y = `calc(var(--jujian-wallpaper-top) + (${height} - ${imageHeight}) * ${readerWallpaperY / 100})`;
      return `background-image:linear-gradient(${tint},${tint}),url("${readerWallpaper}");background-size:100% 100%,${imageWidth} ${imageHeight};background-position:0 0,${x} ${y};background-repeat:no-repeat;background-attachment:scroll,fixed;`;
    }
    const color = readerBackground === 'custom' ? readerCustomColor : presets[readerBackground];
    return `background-color:color-mix(in srgb,var(--jujian-paper-base),${color} var(--jujian-color-strength))!important;`;
  }

  function outerStyles({readerOuterBackground, readerOuterColor, readerBackground, readerCustomColor}) {
    if (readerOuterBackground === 'native') return '';
    const color = readerOuterBackground === 'custom'
      ? readerOuterColor : readerBackground === 'custom' ? readerCustomColor : presets[readerBackground];
    return color ? `background-color:color-mix(in srgb,var(--jujian-outer-base),${color} var(--jujian-outer-strength))!important;` : '';
  }

  return { defaults, markup, textColorMarkup, normalize, connect, paperStyles, outerStyles };
})();
