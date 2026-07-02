"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export default function MapboxTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [status, setStatus] = useState("初始化中…");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!TOKEN) {
      setStatus("❌ Token 未设置");
      return;
    }

    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    console.log("容器尺寸:", rect.width, "x", rect.height);
    setStatus(`容器: ${rect.width}×${rect.height}px | Token: ${TOKEN.slice(0, 20)}…`);

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: el,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98, 39],
      zoom: 3,
    });

    map.on("load", () => {
      console.log("✅ Mapbox map loaded");
      setStatus("✅ 地图加载成功！");
    });

    map.on("error", (e) => {
      console.error("❌ Mapbox error:", e);
      setStatus("❌ 错误: " + (e.error?.message ?? JSON.stringify(e)));
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8 gap-4">
      <h1 className="text-2xl font-bold">Mapbox 基础测试</h1>
      <p className="text-sm bg-white px-4 py-2 rounded shadow text-gray-700 font-mono">{status}</p>
      {/* 固定像素尺寸，最简单可靠的方式 */}
      <div
        ref={containerRef}
        style={{ width: "800px", height: "500px", borderRadius: "12px" }}
        className="shadow-lg border border-gray-200"
      />
    </div>
  );
}
