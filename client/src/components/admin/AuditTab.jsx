"use client";

import { useState } from "react";
import { Alert, Select, Table, Tag } from "antd";
import { useAdmin } from "./useAdmin";

const COLORS = { security: "purple", user: "blue", settings: "gold", campaign: "cyan" };

/** Every admin action and admin security event (logins, 2FA), newest first. */
export default function AuditTab() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const { data, loading, error } = useAdmin(`/audit?page=${page}&action=${encodeURIComponent(action)}`);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Kept for two years. Passwords and codes are never recorded.</p>
        <Select
          className="!w-48"
          value={action}
          onChange={(v) => (setAction(v), setPage(1))}
          options={[
            { value: "", label: "All events" },
            { value: "security.", label: "Security" },
            { value: "user.", label: "User changes" },
            { value: "settings.", label: "Settings" },
            { value: "campaign.", label: "Campaigns" },
          ]}
        />
      </div>
      {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
      <Table
        rowKey="_id"
        loading={loading}
        dataSource={data?.entries || []}
        pagination={{ current: page, pageSize: 50, total: data?.total || 0, showSizeChanger: false, onChange: setPage }}
        scroll={{ x: 800 }}
        columns={[
          { title: "When", dataIndex: "at", key: "at", render: (d) => new Date(d).toLocaleString(), width: 190 },
          { title: "Who", dataIndex: "actorEmail", key: "actorEmail" },
          { title: "Action", dataIndex: "action", key: "action", render: (a) => <Tag color={COLORS[a.split(".")[0]]}>{a}</Tag> },
          { title: "Target", dataIndex: "target", key: "target" },
          {
            title: "Details",
            dataIndex: "details",
            key: "details",
            render: (d) => (d ? <code className="block max-w-md truncate text-xs text-slate-500" title={JSON.stringify(d)}>{JSON.stringify(d)}</code> : null),
          },
          { title: "IP", dataIndex: "ip", key: "ip", render: (ip) => <span className="text-xs text-slate-400">{ip}</span> },
        ]}
      />
    </div>
  );
}
