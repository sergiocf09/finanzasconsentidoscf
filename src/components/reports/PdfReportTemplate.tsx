import React from "react";
import { PdfPage1 } from "./PdfPage1";
import { PdfPage2 } from "./PdfPage2";
import { PdfPage3 } from "./PdfPage3";
import type { PdfReportData } from "./PdfReportData";

interface PdfReportTemplateProps {
  data: PdfReportData;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function PdfReportTemplate({ data, containerRef }: PdfReportTemplateProps) {
  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        width: 794,
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: -1,
        overflow: "hidden",
      }}
    >
      <div id="pdf-page-1" style={{ pageBreakAfter: "always" }}>
        <PdfPage1 data={data} />
      </div>
      <div id="pdf-page-2" style={{ pageBreakAfter: "always" }}>
        <PdfPage2 data={data} />
      </div>
      <div id="pdf-page-3">
        <PdfPage3 data={data} />
      </div>
    </div>
  );
}
