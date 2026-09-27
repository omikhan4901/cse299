"use client";

import { useState } from "react";
import { Button, App } from "antd";
import { Download, Link2 } from "lucide-react";
import { downloadPdf } from "@/pdf/client";

export default function PublicActions({ resume }) {
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadPdf(resume);
    } catch {
      message.error("Could not create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message.success("Link copied");
    } catch {
      message.info(window.location.href);
    }
  };

  return (
    <div className="container-x flex flex-wrap items-center justify-center gap-2 py-6 sm:justify-end">
      <Button icon={<Link2 size={15} />} onClick={copy}>Copy link</Button>
      <Button type="primary" icon={<Download size={15} />} loading={downloading} onClick={download}>Download PDF</Button>
    </div>
  );
}
