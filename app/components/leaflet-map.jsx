"use client";

import { useEffect, useRef } from "react";

const DEFAULT_CENTER = [9.03, 38.78];

export default function LeafletMap({ markers = [], center = DEFAULT_CENTER, zoom = 12, className = "leaflet-map" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const latestMarkersRef = useRef(markers);

  latestMarkersRef.current = markers;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;

    async function initializeMap() {
      const leafletModule = await import("leaflet");
      const leaflet = leafletModule.default || leafletModule;
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, { scrollWheelZoom: false }).setView(center, zoom);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      markerLayerRef.current = leaflet.layerGroup().addTo(map);
      updateMarkers(leaflet, map, markerLayerRef.current, latestMarkersRef.current);
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => map.invalidateSize());
        resizeObserver.observe(containerRef.current);
      }
    }

    initializeMap().catch((error) => console.error("Could not load the map.", error));
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [center, zoom]);

  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current || !markerLayerRef.current) return undefined;
    import("leaflet").then((leafletModule) => {
      const leaflet = leafletModule.default || leafletModule;
      if (!cancelled && mapRef.current && markerLayerRef.current) {
        updateMarkers(leaflet, mapRef.current, markerLayerRef.current, markers);
      }
    }).catch((error) => console.error("Could not update the map markers.", error));
    return () => { cancelled = true; };
  }, [markers]);

  return <div ref={containerRef} className={className} role="application" aria-label="Interactive map" />;
}

function updateMarkers(leaflet, map, layer, markers) {
  layer.clearLayers();
  markers.forEach((item) => {
    if (!Array.isArray(item.position) || item.position.length !== 2) return;
    const icon = leaflet.divIcon({
      className: "leaflet-demo-marker-wrap",
      html: `<span class="leaflet-demo-marker ${item.kind === "trip" ? "leaflet-demo-marker-trip" : ""}"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const marker = leaflet.marker(item.position, { icon, title: item.label || "Car location" }).addTo(layer);
    if (item.href) {
      const popup = document.createElement("a");
      popup.href = item.href;
      popup.textContent = item.label || "View listing";
      marker.bindPopup(popup);
    } else if (item.label) {
      marker.bindPopup(document.createTextNode(item.label));
    }
  });
  if (markers.length > 1) {
    const positions = markers.filter((item) => Array.isArray(item.position)).map((item) => item.position);
    if (positions.length > 1) map.fitBounds(leaflet.latLngBounds(positions).pad(0.18), { maxZoom: 13 });
  }
}
