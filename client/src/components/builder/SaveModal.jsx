"use client";

import { useState } from "react";
import { Modal, Input, Checkbox, Button } from "antd";

/** Asks for a name the first time a resume is saved to the account. */
export default function SaveModal({ open, onCancel, onSave, loading, resume }) {
  return (
    <Modal title="Save to your account" open={open} onCancel={onCancel} footer={null} destroyOnHidden>
      <SaveForm resume={resume} onCancel={onCancel} onSave={onSave} loading={loading} />
    </Modal>
  );
}

function SaveForm({ resume, onCancel, onSave, loading }) {
  const [name, setName] = useState(resume.nickname || (resume.personal.title ? `${resume.personal.title} resume` : "My resume"));
  const [isMaster, setIsMaster] = useState(!!resume.isMaster);
  const submit = () => name.trim() && onSave({ nickname: name.trim(), isMaster });

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">Saved resumes are backed up to your account, update automatically as you edit and can be shared with a link.</p>
      <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="resume-name">
        Resume name
      </label>
      <Input id="resume-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frontend roles – 2026" onPressEnter={submit} />
      <Checkbox className="!mt-4" checked={isMaster} onChange={(e) => setIsMaster(e.target.checked)}>
        Use as my <b>master profile</b> — new resumes can be filled from it
      </Checkbox>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={submit} disabled={!name.trim()} loading={loading}>
          Save resume
        </Button>
      </div>
    </>
  );
}
