'use strict';

const jujianTypography = (() => {
  const controls = [
    {
      key: 'readerFontFamily', label: '正文字体', property: 'font-family',
      options: [
        ['', '跟随微信读书'],
        ['"Microsoft YaHei","PingFang SC",sans-serif', '黑体'],
        ['SimSun,"Songti SC",serif', '宋体'],
        ['KaiTi,"Kaiti SC",serif', '楷体'],
        ['"Noto Serif CJK SC","Source Han Serif SC","思源宋体",SimSun,serif', '思源宋体'],
        ['"Noto Sans CJK SC","Source Han Sans SC","思源黑体","Microsoft YaHei",sans-serif', '思源黑体'],
        ['FangSong,"STFangsong",serif', '仿宋'],
        ['"Microsoft JhengHei","PingFang TC",sans-serif', '正黑体'],
        ['Georgia,SimSun,serif', 'Georgia（西文衬线）'],
        ['Verdana,"Microsoft YaHei",sans-serif', 'Verdana（西文无衬线）'],
      ],
    },
    {
      key: 'readerFontSize', label: '正文字号', property: 'font-size',
      options: [['', '跟随微信读书'], ...Array.from({length: 11}, (_, index) => {
        const size = `${16 + index * 2}px`;
        return [size, size];
      })],
    },
    {
      key: 'readerLineHeight', label: '正文行距', property: 'line-height',
      options: [['', '跟随微信读书'], ...['1.4','1.6','1.8','2.0','2.2','2.4'].map(value => [value, `${value} 倍`])],
    },
  ];

  return {
    controls,
    defaults: Object.fromEntries(controls.map(({key}) => [key, ''])),
    markup: controls.map(({key, label, options}) =>
      `<label for="${key}">${label}<select id="${key}">${options.map(([value, name]) =>
        `<option value='${value}'>${name}</option>`).join('')}</select></label>`).join(''),
    valueFor({options}, value) {
      return options.some(([allowed]) => allowed === value) ? value : '';
    },
  };
})();
