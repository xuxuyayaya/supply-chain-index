const number = (value) => value.toFixed(1);
const priorities = {
  coverage: "补齐关键环节",
  local: "扩大本地配套",
  cr5: "分散核心采购",
  leader: "降低链主依赖",
};

export function assessSupply(data) {
  const { index, metrics, evaluation, trade, stages } = data;
  if (!Number.isFinite(index) || metrics.some((item) => item.value === null))
    return null;
  const [coverage, local, concentration, leader] = metrics;
  const missing = stages.filter((stage) => !stage.covered);
  const improvements = metrics
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.gap * b.weight - a.gap * a.weight);
  const priority = improvements[0];
  const level =
    index >= 85
      ? "供应能力较强"
      : index >= 70
        ? "供应基础较好"
        : index >= 60
          ? "供应配套仍需加强"
          : "基础供应短板较集中";
  const previous = evaluation.previous;
  const change = previous ? index - previous.score : null;
  const changeText =
    change === null
      ? "本期为首个评价月份。"
      : Math.abs(change) < 0.05
        ? "供应分与上月基本持平。"
        : "供应分较上月" +
          (change > 0 ? "提升 " : "下降 ") +
          number(Math.abs(change)) +
          " 分。";
  const shortfall = evaluation.peerIndex - evaluation.development;
  const addedValueGap = evaluation.peerValue - evaluation.addedValue;

  return {
    headline:
      level +
      "，" +
      (priority ? "优先" + priorities[priority.id] : "持续巩固配套优势"),
    summary:
      data.city +
      data.industry +
      "本期供应分 " +
      number(index) +
      " 分。" +
      changeText +
      (priority
        ? priority.name + "是本期建议优先改善的方面。"
        : "四项供应指标均已达到优秀线。"),
    findings: [
      {
        title: missing.length
          ? missing.length + " 个环节尚未稳定覆盖"
          : "关键环节已全部覆盖",
        text:
          "已覆盖 " +
          coverage.numerator +
          " / " +
          coverage.denominator +
          " 个关键环节。" +
          (missing.length
            ? missing.map((stage) => stage.label).join("、") +
              "仍需核实稳定供给。"
            : "后续重点跟踪既有产能和供货的连续性。"),
        dimension: "coverage",
      },
      {
        title: "本地配套率 " + number(local.value) + "%",
        text:
          "本地采购 " +
          number(trade.origins[0].amount) +
          " 亿元，外部采购 " +
          number(trade.purchase - trade.origins[0].amount) +
          " 亿元。" +
          (local.gap > 0
            ? "距优秀线还有 " +
              number(local.gap) +
              " 个百分点，可从大额外采部件寻找本地承接机会。"
            : "已达到优秀线，重点保障本地配套的交付质量。"),
        dimension: "local",
      },
      {
        title:
          "采购集中度" +
          concentration.grade +
          "，链主营收占比 " +
          number(leader.value) +
          "%",
        text:
          "前五家供应商占采购额 " +
          number(concentration.value) +
          "%。" +
          (leader.gap > 0
            ? "链主营收占比距优秀线还有 " +
              number(leader.gap) +
              " 个百分点，宜培育有独立订单的配套企业。"
            : "链主营收占比已达优秀线，继续跟踪核心供应商份额。"),
        dimension: "leader",
      },
    ],
    development: {
      title:
        shortfall > 0.05
          ? "综合发展水平仍有提升空间"
          : "综合发展水平已达到同业基准",
      text:
        "发展指数 " +
        number(evaluation.development) +
        " 分，" +
        (shortfall > 0.05
          ? "距同业测算基准 " + number(shortfall) + " 分。"
          : "同业测算基准为 " + number(evaluation.peerIndex) + " 分。") +
        "物流保障得分 " +
        number(evaluation.logistics) +
        "，" +
        evaluation.keyGoods +
        " 个关键品类中有 " +
        evaluation.bottlenecks +
        " 个存在供应瓶颈。" +
        (addedValueGap > 0.05
          ? "链上增加值较同业测算基准低 " + number(addedValueGap) + " 亿元。"
          : ""),
    },
    actions: improvements.slice(0, 3).map((item) => ({
      title: priorities[item.id],
      text: item.action,
      dimension: item.id,
    })),
  };
}
