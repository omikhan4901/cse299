import React, { useState } from "react";
import {
  Modal,
  Switch,
  Input,
  Button,
  Typography,
  message,
  Space,
  Alert,
} from "antd";
import { CopyOutlined, GlobalOutlined, LockOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../Config/constraints";
import { useAuth } from "../../Context/context-definitions";

const { Text, Paragraph } = Typography;

const ShareModal = ({ open, onCancel, resume, onUpdate }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  // If resume doesn't exist yet (unsaved), we can't share it
  if (!resume || !resume._id) return null;

  const linkId = resume.shortId || resume._id;
  const publicUrl = `${window.location.origin}/view/${linkId}`;

  const handleTogglePublic = async (checked) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/resumes/${resume._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPublic: checked }),
      });

      const data = await response.json();
      if (data.success) {
        message.success(
          checked ? "Resume is now Public" : "Resume is now Private"
        );
        onUpdate(data.data); // Update local state in MainBuilder
      } else {
        message.error("Failed to update privacy settings");
      }
    } catch (error) {
      message.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    message.success("Link copied!");
  };

  return (
    <Modal
      title={
        <Space>
          <GlobalOutlined /> Share Your Resume
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
    >
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text strong>Public Access</Text>
          <Switch
            checked={resume.isPublic}
            onChange={handleTogglePublic}
            loading={loading}
            checkedChildren="Live"
            unCheckedChildren="Private"
          />
        </div>

        <Paragraph type="secondary" style={{ fontSize: "13px" }}>
          {resume.isPublic
            ? "Anyone with this link can view your resume. Perfect for sharing on LinkedIn or email."
            : "Only you can see this resume. Turn on Public Access to generate a shareable link."}
        </Paragraph>
      </div>

      {resume.isPublic ? (
        <div
          style={{
            background: "#f5f5f5",
            padding: "16px",
            borderRadius: "8px",
          }}
        >
          <Text
            style={{
              fontSize: "12px",
              color: "#888",
              display: "block",
              marginBottom: 8,
            }}
          >
            PUBLIC LINK
          </Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input value={publicUrl} readOnly />
            <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
              Copy
            </Button>
          </Space.Compact>
          <Alert
            message="Link is live"
            type="success"
            showIcon
            style={{ marginTop: 12, fontSize: "12px", padding: "8px 12px" }}
          />
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            background: "#fff1f0",
            borderRadius: "8px",
            border: "1px solid #ffa39e",
          }}
        >
          <LockOutlined
            style={{ fontSize: "24px", color: "#ff4d4f", marginBottom: 8 }}
          />
          <Text style={{ display: "block", color: "#cf1322" }}>
            Sharing is disabled
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default ShareModal;
