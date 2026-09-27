"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { Modal, Slider, Button, Segmented } from "antd";
import { ZoomIn, ZoomOut, RotateCcw, Move } from "lucide-react";
import { cropPhoto } from "./photo";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

/**
 * Position and zoom a profile photo inside the round frame. Zooming below 100%
 * fits more of the photo in and fills the gap with a background colour.
 */
export default function PhotoCropModal({ open, src, initial, onCancel, onSave }) {
  return (
    <Modal open={open} onCancel={onCancel} footer={null} width={520} title="Adjust your photo" destroyOnHidden centered>
      {src ? <CropEditor src={src} initial={initial} onCancel={onCancel} onSave={onSave} /> : null}
    </Modal>
  );
}

function CropEditor({ src, initial, onCancel, onSave }) {
  const [crop, setCrop] = useState(initial?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initial?.zoom || 1);
  const [background, setBackground] = useState(initial?.background || "#ffffff");
  const [area, setArea] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_, pixels) => setArea(pixels), []);

  const save = async () => {
    if (!area) return;
    setSaving(true);
    try {
      const cropped = await cropPhoto(src, area, { background });
      onSave({ image: cropped, settings: { crop, zoom, background } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="relative h-80 overflow-hidden rounded-2xl">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomSpeed={0.15}
          aspect={1}
          cropShape="round"
          showGrid={false}
          restrictPosition={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          // The container shows the fill colour, so zoomed-out space previews exactly as saved.
          style={{
            containerStyle: { backgroundColor: background },
            cropAreaStyle: { border: "3px solid rgba(255,255,255,.95)", boxShadow: "0 0 0 9999px rgba(15,31,42,.6)" },
          }}
        />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Move size={12} /> Drag to reposition · scroll or pinch to zoom
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button type="text" size="small" icon={<ZoomOut size={16} />} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))} aria-label="Zoom out" />
        <Slider className="flex-1" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom} onChange={setZoom} tooltip={{ formatter: (v) => `${Math.round(v * 100)}%` }} />
        <Button type="text" size="small" icon={<ZoomIn size={16} />} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))} aria-label="Zoom in" />
        <Button
          type="text"
          size="small"
          icon={<RotateCcw size={15} />}
          onClick={() => {
            setZoom(1);
            setCrop({ x: 0, y: 0 });
          }}
          aria-label="Reset"
        />
      </div>

      {zoom < 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Fill empty space with</span>
          <Segmented
            size="small"
            value={background}
            onChange={setBackground}
            options={[
              { label: "White", value: "#ffffff" },
              { label: "Light grey", value: "#e5e7eb" },
              { label: "Dark", value: "#1f2937" },
            ]}
          />
        </div>
      ) : null}

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={save} loading={saving} disabled={!area}>
          Use photo
        </Button>
      </div>
    </div>
  );
}
