"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { SafetyState } from "@/types/api";
import styles from "./screens.module.css";

interface Props {
  state: SafetyState;
  patientLabel: string;
}

export function LocationMap({ state, patientLabel }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const radius = useRef<google.maps.Circle | null>(null);
  const homeMarker = useRef<google.maps.Marker | null>(null);
  const patient = useRef<google.maps.Marker | null>(null);
  const [loadError, setLoadError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let disposed = false;
    if (!apiKey || !state.zone.home) return;
    setLoadError("");
    setOptions({ key: apiKey, v: "weekly" });
    void importLibrary("maps").then(() => {
      if (disposed || !host.current || map.current || !state.zone.home) return;
      const home = state.zone.home;
      const center = { lat: home.lat, lng: home.lon };
      const instance: google.maps.Map = new google.maps.Map(host.current, {
        center,
        zoom: 16,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });
      map.current = instance;
      radius.current = new google.maps.Circle({ map: instance, center, radius: state.zone.radiusM, strokeColor: "#176b52", strokeOpacity: 1, strokeWeight: 3, fillColor: "#55a77d", fillOpacity: 0.2 });
      homeMarker.current = new google.maps.Marker({ map: instance, position: center, title: "Home" });
      const bounds = radius.current.getBounds();
      if (bounds) instance.fitBounds(bounds, 24);
      if (state.lastFix) {
        patient.current = new google.maps.Marker({ map: instance, position: { lat: state.lastFix.lat, lng: state.lastFix.lon }, title: patientLabel, label: "P" });
      }
    }).catch(() => {
      if (!disposed) setLoadError("Google Maps could not load. Check that Maps JavaScript API and billing are enabled, and that localhost:3000 is allowed for this key.");
    });
    return () => {
      disposed = true;
      homeMarker.current?.setMap(null);
      patient.current?.setMap(null);
      radius.current?.setMap(null);
      map.current = null;
      radius.current = null;
      homeMarker.current = null;
      patient.current = null;
    };
  }, [apiKey, state.zone.home?.lat, state.zone.home?.lon]);

  useEffect(() => {
    const home = state.zone.home;
    if (!map.current || !home) return;
    radius.current?.setRadius(state.zone.radiusM);
    radius.current?.setOptions({ strokeColor: state.outside ? "#b34b3d" : "#176b52", fillColor: state.outside ? "#d97868" : "#55a77d" });
    if (state.lastFix) {
      const position = { lat: state.lastFix.lat, lng: state.lastFix.lon };
      if (!patient.current) patient.current = new google.maps.Marker({ map: map.current, title: patientLabel, label: "P" });
      patient.current.setPosition(position);
    } else {
      patient.current?.setMap(null);
      patient.current = null;
    }
  }, [state, patientLabel]);

  if (!apiKey) return <div className={styles.locationMap} role="status">Google Maps API key is not configured.</div>;
  if (loadError) return <div className={styles.locationMap} role="alert">{loadError}</div>;
  return <div ref={host} className={styles.locationMap} role="img" aria-label={`${patientLabel} location and safe-zone radius`} />;
}
