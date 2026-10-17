// A document viewer that can jump to a page and highlight a spot on it (used when checking what the AI read).
// PDFs are drawn with pdf.js (runs in the browser; nothing is sent anywhere). Images are shown as they are.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Box = { x: number; y: number; w: number; h: number };
/** Where to look: a page (1-based), optionally a box on it (fractions of the page). `n` changes on every jump. */
export type Focus = { page: number; box: Box | null; label?: string; n: number };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function Highlight({ box, label, n }: { box: Box | null; label?: string; n: number }) {
  if (!box) {
    return (
      <div key={n} className="pointer-events-none absolute inset-0 animate-[pulse_1s_ease-in-out_2] rounded-sm ring-4 ring-violet-500/70">
        {label && <span className="absolute left-2 top-2 rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">{label}</span>}
      </div>
    );
  }
  // A little padding: the AI's box is an estimate.
  const pad = 0.012;
  const x = clamp(box.x - pad), y = clamp(box.y - pad);
  const w = clamp(box.x + box.w + pad) - x, h = clamp(box.y + box.h + pad) - y;
  return (
    <div key={n} className="pointer-events-none absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}>
      <div className="absolute inset-0 animate-[pulse_0.8s_ease-in-out_3] rounded bg-yellow-300/35 ring-2 ring-violet-600" />
      {label && <span className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">{label}</span>}
    </div>
  );
}

function PdfPage({ doc, num, width, focus }: { doc: pdfjs.PDFDocumentProxy; num: number; width: number; focus: Focus | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(11 / 8.5);
  const [visible, setVisible] = useState(num <= 2);

  useEffect(() => {
    let alive = true;
    doc.getPage(num).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (alive) setRatio(v.height / v.width);
    });
    return () => { alive = false; };
  }, [doc, num]);

  // Only draw pages near the screen (packets can be 25+ pages).
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current || width < 50) return;
    let task: pdfjs.RenderTask | null = null;
    let alive = true;
    doc.getPage(num).then((p) => {
      if (!alive || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      task = p.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp });
      task.promise.catch(() => undefined);
    });
    return () => { alive = false; task?.cancel(); };
  }, [doc, num, width, visible]);

  useEffect(() => {
    if (focus?.page === num && holder.current) {
      const target = focus.box ? holder.current.offsetTop + focus.box.y * holder.current.offsetHeight - 120 : holder.current.offsetTop - 8;
      holder.current.parentElement?.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }
  }, [focus, num]);

  return (
    <div ref={holder} data-page={num} className="relative mx-auto mb-3 bg-white shadow" style={{ width, height: width * ratio }}>
      <canvas ref={canvas} className="h-full w-full" />
      <span className="absolute bottom-1 right-2 rounded bg-slate-900/60 px-1.5 text-[10px] text-white">{num}</span>
      {focus?.page === num && <Highlight box={focus.box} label={focus.label} n={focus.n} />}
    </div>
  );
}

export function PageViewer({ documentId, mimeType, focus, height = "calc(100vh - 150px)" }: { documentId: number; mimeType: string; focus: Focus | null; height?: string }) {
  const url = `/api/documents/${documentId}/file`;
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [boxWidth, setBoxWidth] = useState(600);
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth - 24));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isPdf) return;
    setDoc(null);
    setError(null);
    let alive = true; // a cancelled load (e.g. after switching documents) must not overwrite the current one
    const task = pdfjs.getDocument({ url, withCredentials: true });
    task.promise.then((d) => alive && setDoc(d), () => alive && setError("This PDF couldn't be shown here. Use “Open” to view it."));
    return () => { alive = false; task.destroy(); };
  }, [url, isPdf]);

  const width = Math.max(200, boxWidth * zoom);
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ height }}>
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-1">
        {doc && <span className="px-1 text-xs text-slate-500">{doc.numPages} page{doc.numPages === 1 ? "" : "s"}</span>}
        <span className="ml-auto" />
        <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out"><ZoomOut size={14} /></button>
        <span className="w-10 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in"><ZoomIn size={14} /></button>
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
      </div>
      <div ref={scroller} className="relative flex-1 overflow-auto p-3">
        {isPdf ? (
          error ? <div className="p-6 text-sm text-slate-500">{error}</div>
          : !doc ? <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Opening…</div>
          : Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} num={i + 1} width={width} focus={focus} />)
        ) : mimeType.startsWith("image/") && mimeType !== "image/tiff" && mimeType !== "image/heic" ? (
          <div className="relative mx-auto bg-white shadow" style={{ width }}>
            <img src={url} alt="Document" className="block w-full" />
            {focus && <Highlight box={focus.box} label={focus.label} n={focus.n} />}
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">This file type can't be previewed here. Use “Open” to download it.</div>
        )}
      </div>
    </div>
  );
}
