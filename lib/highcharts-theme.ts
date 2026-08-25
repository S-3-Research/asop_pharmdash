import Highcharts from "highcharts";

/**
 * Highcharts injects its own CSS palette (highcharts-palette.css) which uses
 * `light-dark()` CSS values tied to the OS/browser `prefers-color-scheme`.
 * That makes chart backgrounds, tooltips, axis labels, etc. flip between
 * light/dark automatically regardless of our own app theme.
 *
 * We pin the palette to a fixed light theme here, once, so every chart in
 * the app (tooltips included) stays visually consistent no matter what the
 * user's system theme is set to.
 *
 * Import this module (for its side effect) once near the root of the
 * dashboard client tree — see dashboard-shell.tsx.
 */
Highcharts.setOptions({
  colors: [
    "#2caffe",
    "#544fc5",
    "#00e272",
    "#fe6a35",
    "#6b8abc",
    "#d568fb",
    "#2ee0ca",
    "#fa4b42",
    "#feb56a",
    "#91e8e1",
  ],
  chart: {
    backgroundColor: "#ffffff",
    style: {
      color: "#171717",
    },
  },
  title: {
    style: { color: "#171717" },
  },
  subtitle: {
    style: { color: "#475569" },
  },
  xAxis: {
    labels: { style: { color: "#334155" } },
    lineColor: "#334155",
    tickColor: "#334155",
    gridLineColor: "#e6e6e6",
    title: { style: { color: "#666666" } },
  },
  yAxis: {
    labels: { style: { color: "#334155" } },
    gridLineColor: "#e6e6e6",
    title: { style: { color: "#666666" } },
  },
  legend: {
    itemStyle: { color: "#334155" },
    itemHoverStyle: { color: "#000000" },
    itemHiddenStyle: { color: "#cccccc" },
  },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    style: {
      color: "#171717",
    },
  },
  plotOptions: {
    series: {
      borderColor: "#ffffff",
      dataLabels: {
        style: { color: "#171717", textOutline: "none" },
      },
      marker: {
        lineColor: "#ffffff",
      },
    },
    column: {
      borderColor: "#ffffff",
    },
    columnrange: {
      borderColor: "#ffffff",
    },
    bar: {
      borderColor: "#ffffff",
    },
    pie: {
      borderColor: "#ffffff",
    },
  },
});

export {};
