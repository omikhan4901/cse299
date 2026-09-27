"use client";

import { useState } from "react";
import { Button, Modal, App } from "antd";
import { Download, FileText, Link2 } from "lucide-react";
import dynamic from "next/dynamic";
import { downloadPdf } from "@/pdf/client";

const PdfPreview = dynamic(() => import("../builder/PdfPreview"), { ssr: false });

export default function PublicActions({ resume }) {
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState(false);

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
      <Button icon={<FileText size={15} />} onClick={() => setPreview(true)}>View as PDF</Button>
      <Button type="primary" icon={<Download size={15} />} loading={downloading} onClick={download}>Download PDF</Button>
      <Modal open={preview} onCancel={() => setPreview(false)} footer={null} width={880} title={`${resume.personal.name || "Resume"} – PDF`} destroyOnHidden>
        <div className="thin-scroll max-h-[75vh] overflow-y-auto bg-slate-100 p-4">
          <PdfPreview resume={resume} />
        </div>
      </Modal>
    </div>
  );
}
