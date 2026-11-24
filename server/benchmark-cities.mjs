const city = (province, name, gdp, source, hubs, coordinates, size, strength) => ({
  province, name, gdp, year: 2025, source, hubs, coordinates, size, strength,
});

export const cityBenchmarks = {
  kaifeng: city("河南", "开封市", 2860.06, "https://www.yuwangtai.gov.cn/kfsywtqwz/sjfbnr/pc/content/content_2021852518215118848.html"),
  jiaozuo: city("河南", "焦作市", 2479.6, "https://www.jiaozuo.gov.cn/2026/01-27/593852.html",
    ["焦作产业集货区", "焦作铁路货场", "郑州国际陆港"], [113.24, 35.24], 0.87, 1),
  xuchang: city("河南", "许昌市", 3583.4, "https://www.xuchang.gov.cn/xcsrmzfsjfb/037003/20260512/c6a7ee09-1daf-45ed-8bbf-63b6175f62d2.html",
    ["许昌产业集货区", "许昌铁路货场", "郑州国际陆港"], [113.85, 34.04], 1.25, 3),
  suzhou: city("江苏", "苏州市", 27695.1, "https://www.suzhou.gov.cn/szsrmzf/ndgmjjhshfztjsjfb/202605/0543af82405748cd9ffa4cfc81aecccd.shtml"),
  nanjing: city("江苏", "南京市", 19428.78, "https://tjj.nanjing.gov.cn/gzdt/202602/t20260203_5785885.html",
    ["南京产业集货区", "南京铁路货场", "南京港"], [118.80, 32.06], 0.72, -2),
  wuxi: city("江苏", "无锡市", 16773.94, "https://www.wuxi.gov.cn/doc/2026/05/09/4772440.shtml",
    ["无锡产业集货区", "无锡铁路货场", "江阴港"], [120.31, 31.49], 0.66, -1),
  nanchang: city("江西", "南昌市", 8141.69, "https://www.nc.gov.cn/ncszf/tjfx1/202601/05e40bffc5dd429aac122f372223620f.shtml"),
  ganzhou: city("江西", "赣州市", 5221.29, "https://www.ganzhou.gov.cn/gzszf/c100022/202604/38a12f964da545109b1b16697faee249.shtml",
    ["赣州产业集货区", "赣州国际陆港", "九江港"], [114.94, 25.83], 0.67, -2),
  jiujiang: city("江西", "九江市", 4246.51, "https://www.jjxw.cn/article/2026/05/29/779574.html",
    ["九江产业集货区", "九江铁路货场", "九江港"], [116.00, 29.71], 0.55, -3),
};

export function cityComparison(currentId, peerId) {
  const current = cityBenchmarks[currentId], peer = cityBenchmarks[peerId];
  return {
    province: peer.province, sameProvince: current.province === peer.province,
    year: peer.year, cityGDP: peer.gdp, cityGDPGap: Math.abs(peer.gdp - current.gdp),
    cityGDPGapRate: Math.abs(peer.gdp - current.gdp) / current.gdp * 100,
    source: peer.source, currentGDP: current.gdp, currentSource: current.source,
  };
}

export function compareCities(a, b) {
  return Number(b.sameProvince) - Number(a.sameProvince) || a.cityGDPGap - b.cityGDPGap;
}
