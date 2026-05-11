import { useEffect, useState } from "react";

export interface ImageDisplayProps {
  src: string;
  alt?: string;
  /** Optional filename to show in the metadata footer. */
  filename?: string;
  /** Optional size info to show in the metadata footer. */
  sizeLabel?: string;
  /** Max image height in pixels. Default 400. Lightbox bypasses this. */
  maxHeight?: number;
  /** Click-to-expand modal. Default true. */
  lightbox?: boolean;
  /** Skip the metadata footer. */
  hideMeta?: boolean;
  className?: string;
}

type Status = "loading" | "loaded" | "errored";

export function ImageDisplay({
  src,
  alt = "",
  filename,
  sizeLabel,
  maxHeight = 400,
  lightbox = true,
  hideMeta = false,
  className,
}: ImageDisplayProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setStatus("loading");
    setErrMsg(null);
  }, [src]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const showMeta = !hideMeta && (filename || sizeLabel);

  return (
    <>
      <div
        className={[
          "ar-imgblock",
          status === "loading" ? "loading" : "",
          status === "errored" ? "errored" : "",
          className,
        ].filter(Boolean).join(" ")}
      >
        <div className="img-wrap" style={{ maxHeight, overflow: "hidden" }}>
          {status === "errored" ? (
            <div className="ph">⚠ Failed to load{errMsg ? ` — ${errMsg}` : ""}</div>
          ) : (
            <>
              {status === "loading" && <div className="ph">loading…</div>}
              <img
                src={src}
                alt={alt}
                loading="lazy"
                style={{
                  display: status === "loaded" ? "block" : "none",
                  maxHeight,
                  objectFit: "contain",
                }}
                onLoad={() => setStatus("loaded")}
                onError={(e) => {
                  setStatus("errored");
                  const target = e.currentTarget as HTMLImageElement;
                  setErrMsg(target.src ? "couldn't fetch resource" : null);
                }}
              />
            </>
          )}
        </div>
        {lightbox && status === "loaded" && (
          <button
            type="button"
            className="lightbox-btn"
            onClick={() => setLightboxOpen(true)}
            aria-label="Expand image"
          >
            ⤢ Expand
          </button>
        )}
        {showMeta && (
          <div className="img-meta">
            <span>{filename ?? alt}</span>
            {sizeLabel && <span className="grow">{sizeLabel}</span>}
          </div>
        )}
      </div>
      {lightboxOpen && (
        <div
          className="ar-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="close"
            onClick={() => setLightboxOpen(false)}
          >
            Close
          </button>
          <img src={src} alt={alt} />
        </div>
      )}
    </>
  );
}
