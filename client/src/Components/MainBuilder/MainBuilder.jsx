import React, { useState, useEffect, useMemo } from "react";
import { useAuth, useRouter } from "../../Context/context-definitions";
import AiAuditModal from "../AiChat/AiAuditModal";
import CoverLetterModal from "../CoverLetterModal/CoverLetterModal";

import {
  Layout,
  Spin,
  Alert,
  Drawer,
  Upload,
  Button,
  Space,
  Typography,
  notification,
  Card,
  List,
  Tooltip,
  Divider,
  Modal,
} from "antd";
import {
  DownloadOutlined,
  LayoutOutlined,
  SaveOutlined,
  MessageOutlined,
  UploadOutlined,
  LoadingOutlined,
  SettingOutlined,
  AppstoreAddOutlined,
  UserOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  BookOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined
} from "@ant-design/icons";
import ShareModal from "./ShareModal"; // Import new mo / Import icon
import ResumeDesigns from "../ResumePreview/ResumeDesigns";
import ChatModal from "../AiChat/AiChat";
import SaveResumeModal from "./SaveResumeModal"; // NEW IMPORT
import { SectionForms } from "./SectionForms";
import { initialResumeState, API_BASE_URL } from "../../Config/constraints";

const { Content } = Layout;
const { Title, Text, Link, Paragraph } = Typography;

const areResumesEqual = (objA, objB) => {
  if (objA === objB) return true;
  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  )
    return false;

  // We ignore transient or generated fields when checking for "dirtiness"
  const ignoredKeys = new Set([
    "_id",
    "updatedAt",
    "createdAt",
    "shortId",
    "nickname",
    "template",
  ]);

  const keysA = Object.keys(objA).filter(
    (key) => !ignoredKeys.has(key) && typeof objA[key] !== "function"
  );
  const keysB = Object.keys(objB).filter(
    (key) => !ignoredKeys.has(key) && typeof objB[key] !== "function"
  );

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;

    // Handle nested objects/arrays (recursive check)
    if (
      typeof objA[key] === "object" &&
      objA[key] !== null &&
      !Array.isArray(objA[key])
    ) {
      if (!areResumesEqual(objA[key], objB[key])) return false;
    } else if (objA[key] !== objB[key]) {
      return false;
    }
  }
  return true;
};
const ResumeBuilder = () => {
  const { user, loading: authLoading, token } = useAuth();
  const { navigate } = useRouter();

  // --- State ---
  const [resume, setResume] = useState(initialResumeState);
  const [refiningId, setRefiningId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Save Modal State
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(
    initialResumeState.template || "Classic"
  );
  const [editingSection, setEditingSection] = useState(null);

  const [api, contextHolder] = notification.useNotification();
  const [isSectionDrawerOpen, setIsSectionDrawerOpen] = useState(false);

  const [auditOpen, setAuditOpen] = useState(false);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showPageBreaks, setShowPageBreaks] = useState(false);

  const [modal, modalContextHolder] = Modal.useModal();

  const [savedResume, setSavedResume] = useState(initialResumeState);
  const [savedDesign, setSavedDesign] = useState(
    initialResumeState.template || "Classic"
  );

  const isDirty = useMemo(() => {
    const contentChanged = !areResumesEqual(resume, savedResume);
    const designChanged = selectedDesign !== savedDesign; // Compares current preview vs. last saved design

    return contentChanged || designChanged;
  }, [resume, savedResume, selectedDesign, savedDesign]);

  // 1. Effect to check for an existing resume ID on mount
  useEffect(() => {
    const loadResume = async () => {
      const resumeId = localStorage.getItem("currentResumeId");

      if (resumeId && token) {
        try {
          api.info({
            message: "Loading Resume...",
            description: "Fetching your data.",
            duration: 1,
            key: "resume_loading",
          });

          const response = await fetch(`${API_BASE_URL}/resumes/${resumeId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();

          if (data.success) {
            const loadedResume = data.data;

            // Sanitize state on load
            setResume(loadedResume);
            setSavedResume(loadedResume);
            setSelectedDesign(loadedResume.template || "Classic");
            setSavedDesign(loadedResume.template || "Classic");
            api.success({
              message: `Loaded: ${loadedResume.nickname}`,
              placement: "topRight",
              key: "resume_load_success",
            });
          }
        } catch (error) {
          console.error("Load failed", error);
          localStorage.removeItem("currentResumeId");
          setResume(initialResumeState);
          setSelectedDesign(initialResumeState.template || "Classic"); // Reset to default preview
          api.error({
            message: "Resume Not Found",
            description: "The saved ID was invalid. Starting fresh.",
            key: "load_error",
          });
        }
      }
    };

    if (!authLoading) {
      loadResume();
    }
  }, [token, authLoading]);
  // --- Handlers ---
  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // Prevent browser save
        handleSaveProfile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // Empty dependency array = active throughout the component's life

  const handleThemeUpdate = (newTemplate) => {
    if (newTemplate) {
      setSelectedDesign(newTemplate);
    }
  };

  const handleFormChange = (section, changedValues) => {
    if (
      section === "summary" ||
      section === "skills" ||
      section === "personal"
    ) {
      // For personal, summary, skills, we merge
      if (section === "personal") {
        setResume((prev) => ({
          ...prev,
          personal: { ...prev.personal, ...changedValues },
        }));
      } else {
        setResume((prev) => ({ ...prev, ...changedValues }));
      }
    } else {
      // Fallback for safety, though specific sections are handled above
      setResume((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...changedValues },
      }));
    }
  };

  const handleListUpdate = (section, id, field, value) => {
    setResume((prev) => ({
      ...prev,
      [section]: prev[section].map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleAddItem = (section) => {
    const newEntry =
      section === "experience"
        ? {
            id: Date.now(),
            company: "",
            title: "",
            startDate: "",
            endDate: "",
            description: "",
          }
        : {
            id: Date.now(),
            institution: "",
            degree: "",
            startYear: "",
            endYear: "",
          };
    setResume((prev) => ({ ...prev, [section]: [...prev[section], newEntry] }));
  };

  const handleDeleteItem = (section, id) => {
    setResume((prev) => ({
      ...prev,
      [section]: prev[section].filter((item) => item.id !== id),
    }));
  };

  const handleSetResume = (newResume) => {
    setResume(newResume);
  };

  // --- LOAD MASTER PROFILE ---
  const handleLoadMaster = async () => {
    if (!token) return;
    setUploadLoading(true); // Reuse the loading state
    try {
      // Fetch all resumes
      const response = await fetch(`${API_BASE_URL}/resumes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        // Find the one marked isMaster
        const master = data.data.find((r) => r.isMaster);

        if (master) {
          // Load it, BUT keep the current ID null so it saves as a NEW resume
          const { _id, createdAt, updatedAt, nickname, ...contentToCopy } =
            master;

          setResume((prev) => ({
            ...prev,
            ...contentToCopy, // Overwrite current state with master data
            nickname: `Copy of ${nickname}`,
          }));

          if (contentToCopy.template) setSelectedDesign(contentToCopy.template);
          api.success({
            message: "Master Profile Loaded!",
            placement: "topRight",
          });
        } else {
          api.warning({
            message: "No Master Profile Found",
            description: 'Save a resume as "Master" first.',
            placement: "topRight",
          });
        }
      }
    } catch (error) {
      console.error(error);
      api.error({ message: "Failed to load profile", placement: "topRight" });
    } finally {
      setUploadLoading(false);
    }
  };

  // --- NEW HANDLER FOR SUMMARY REFINEMENT ---
  const handleRefineSummary = async () => {
    if (!token) return;
    const currentSummary = resume.summary;
    if (!currentSummary)
      return api.info({
        message: "Please write some text first!",
        placement: "topRight",
      });

    setRefiningId("summary"); // Use special ID for summary
    try {
      const response = await fetch(`${API_BASE_URL}/ai/refine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resumeText: currentSummary,
          fullResume: resume,
          sectionType: "summary",
        }),
      });
      const data = await response.json();
      if (data.success && data.refinedText) {
        // Update state directly
        setResume((prev) => ({ ...prev, summary: data.refinedText }));
        api.success({ message: "About Me Refined", placement: "topRight" });
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      api.error({
        message: "Refine Failed",
        description: error.message,
        placement: "topRight",
      });
    } finally {
      setRefiningId(null);
    }
  };

  const handleRefineExperience = async (itemId, originalText) => {
    if (!token) return navigate("/");
    setRefiningId(itemId);
    try {
      const response = await fetch(`${API_BASE_URL}/ai/refine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // Context enrichment: Sending full resume data allows better AI inference
        body: JSON.stringify({
          resumeText: originalText,
          fullResume: resume,
          sectionType: "experience",
        }),
      });
      const data = await response.json();
      if (data.success && data.refinedText) {
        handleListUpdate("experience", itemId, "description", data.refinedText);
        api.success({ message: "Content Refined", placement: "topRight" });
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      api.error({
        message: "Refine Failed",
        description: error.message,
        placement: "topRight",
      });
    } finally {
      setRefiningId(null);
    }
  };

  const handleChatSave = (newText) => {
    setResume((prev) => ({ ...prev, summary: newText }));
    setChatOpen(false);
  };

  const handleResumeUpdate = (updatedResume) => {
    setResume(updatedResume);
  };

  const handleParseResume = async (options) => {
    const { file } = options;
    if (!token) return navigate("/");
    setUploadError(null);
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("resumeFile", file);
      const response = await fetch(`${API_BASE_URL}/ai/parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success && data.extractedData) {
        const extracted = data.extractedData;
        const mappedData = {
          ...resume, // Keep current state (like template)
          personal: { ...resume.personal, ...extracted.personal },
          summary: extracted.summary || "",
          experience: (extracted.experience || []).map((item, index) => ({
            ...item,
            id: Date.now() + index,
            description: item.description || "",
          })),
          education: (extracted.education || []).map((item, index) => ({
            ...item,
            id: Date.now() + index + 100,
          })),
          skills: extracted.skills || "",
        };
        setResume(mappedData);
        api.success({ message: "Resume Parsed!", placement: "topRight" });
      } else {
        throw new Error(data.error || "Could not extract valid data");
      }
    } catch (error) {
      setUploadError(error.message);
      api.error({
        message: "Parse Failed",
        description: error.message,
        placement: "topRight",
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // --- PDF GENERATION ---
  const handleDownloadPDF = () => {
    // Check for unsaved changes before printing
    if (isDirty) {
      modal.confirm({
        title: "Unsaved Changes!",
        content: (
          <div>
            <Paragraph>
              You have unsaved content edits or a temporary template selected (
              {selectedDesign}).
            </Paragraph>
            <Paragraph strong>
              Printing now will use your current (unsaved) view. Save first?
            </Paragraph>
          </div>
        ),
        okText: "Yes, Print Current View",
        cancelText: "Cancel & Save First",
        centered: true,
        onOk: () => {
          // Proceed with printing logic
          localStorage.setItem("printData", JSON.stringify(resume));
          localStorage.setItem("printDesign", selectedDesign);
          api.info({
            message: "Generating Print View...",
            description: "Please wait for the print dialog.",
            placement: "topRight",
            key: "print_info",
          });
          navigate("/print");
        },
      });
    } else {
      // 2. If clean, print immediately
      localStorage.setItem("printData", JSON.stringify(resume));
      localStorage.setItem("printDesign", selectedDesign);
      api.info({
        message: "Generating Print View...",
        description: "Please wait for the print dialog.",
        placement: "topRight",
        key: "print_info",
      });
      navigate("/print");
    }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleMoveItem = (section, index, direction) => {
    // Create a copy of the array to avoid mutating state directly
    const list = [...resume[section]];

    // Swap logic
    if (direction === "up" && index > 0) {
      [list[index], list[index - 1]] = [list[index - 1], list[index]];
    } else if (direction === "down" && index < list.length - 1) {
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
    }

    // Update state
    setResume((prev) => ({ ...prev, [section]: list }));
  };

  // --- SAVE LOGIC START ---

  // 1. Triggered by Sidebar Button
  const handleSaveProfile = () => {
    setSaveModalOpen(true);
  };

  // 2. Triggered by Modal "Save" button
  const confirmSave = async (nickname, isMaster) => {
    if (!token) return;
    setIsSaving(true);

    try {
      const method = resume._id ? "PUT" : "POST";
      const endpoint = resume._id ? `resumes/${resume._id}` : "resumes";

      const payload = {
        ...resume,
        nickname,
        isMaster, // Now this variable exists!
        template: selectedDesign,
      };
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        const savedData = data.data;
        setResume(savedData);
        setSavedResume(savedData); // RESET CONTENT ANCHOR
        setSelectedDesign(savedData.template || "Classic");
        setSavedDesign(savedData.template || "Classic");
        // NEW: Lock this session to this resume ID
        localStorage.setItem("currentResumeId", savedData._id);

        api.success({
          message: "Profile Saved Successfully!",
          placement: "topRight",
        });
        setSaveModalOpen(false);
      } else {
        throw new Error(data.error || "Failed to save.");
      }
    } catch (error) {
      console.error(error);
      api.error({
        message: "Save Failed",
        description: error.message,
        placement: "topRight",
      });
    } finally {
      setIsSaving(false);
    }
  };
  // --- SAVE LOGIC END ---

  const sectionListData = [
    { title: "Personal Info", key: "personal", icon: <UserOutlined /> },
    { title: "About Me", key: "summary", icon: <FileTextOutlined /> }, // Renamed Label
    { title: "Experience", key: "experience", icon: <ThunderboltOutlined /> },
    { title: "Education", key: "education", icon: <BookOutlined /> },
    { title: "Skills", key: "skills", icon: <SettingOutlined /> },
  ];

  const openSectionFromList = (sectionKey) => {
    setIsSectionDrawerOpen(false);
    setEditingSection(sectionKey);
  };

  const toolBtnStyle = {
    width: "56px",
    height: "56px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "12px",
    fontSize: "20px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  };

  if (authLoading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      {modalContextHolder}
      {/* New Save Modal */}
      <SaveResumeModal
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onSave={confirmSave}
        loading={isSaving}
        initialNickname={resume.nickname}
      />
      <CoverLetterModal
        open={coverLetterOpen}
        onClose={() => setCoverLetterOpen(false)}
        resumeData={resume}
      />
      <ShareModal
        open={shareModalOpen}
        onCancel={() => setShareModalOpen(false)}
        resume={resume}
        onUpdate={handleResumeUpdate}
      />
      {/* Scrollbar Hider Style */}
      <style>
        {`
                    .hide-scrollbar::-webkit-scrollbar { display: none; }
                    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}
      </style>

      <Layout
        style={{ minHeight: "calc(100vh - 64px)", background: "#f0f2f5" }}
      >
        <ChatModal
          resumeData={resume}
          onSave={handleChatSave}
          onClose={() => setChatOpen(false)}
          open={chatOpen}
        />

        {/* AI Audit / Analysis Modal */}
        <AiAuditModal
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          resumeData={resume}
        />
        <Content
          style={{
            padding: "24px",
            // Removed left padding adjustment since we are removing the fixed sidebar logic if we want
            // But let's keep the layout simple. We will add a STICKY TOOLBAR at the top of the content.
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
            overflowY: "auto",
          }}
        >
          {/* Main Action Area */}
          
          <Card
            style={{
              marginBottom: 24,
              background: "#fff",
              maxWidth: "850px",
              margin: "0 auto 24px auto",
            }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              {/* Inside the Parser Card */}
              <div className="flex justify-between items-center">
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    Resume Content
                  </Title>
                  <Text type="secondary">
                    Start from your master profile or upload a file.
                  </Text>
                </div>

                <Space>
                  {/* NEW BUTTON */}
                  <Button onClick={handleLoadMaster} loading={uploadLoading}>
                    Auto-fill from Master
                  </Button>

                  {/* EXISTING UPLOAD BUTTON */}
                  <Upload
                    customRequest={handleParseResume}
                    showUploadList={false}
                    disabled={uploadLoading}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadLoading}>
                      Import File
                    </Button>
                  </Upload>
                </Space>
              </div>
              {uploadError && (
                <Alert
                  message={uploadError}
                  type="error"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </Space>
          </Card>

          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              transition: "transform 0.3s ease",
              // We need to ensure it takes up space so scroll works when zoomed in
              marginBottom: `${(zoom - 1) * 300}px` 
            }}
          >
            <ResumeDesigns
              data={resume}
              selectedDesign={selectedDesign}
              onEditSection={setEditingSection}
              showPageBreaks={showPageBreaks}
              editingSection={editingSection}
            />
          </div>
        </Content>

        {/* --- PREMIUM FLOATING SIDEBAR --- */}
        <div
          style={{
            position: "fixed",
            right: "32px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "80px",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            borderRadius: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)",
            padding: "24px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            zIndex: 100,
            maxHeight: "90vh",
            overflowY: "auto",
          }}
          className="hide-scrollbar"
        >
          {/* GROUP 1: EDITOR */}
          <Tooltip title="Manage Sections" placement="left">
            <Button
              type="text"
              shape="circle"
              size="large"
              style={{ color: "#595959", fontSize: "20px" }}
              icon={<AppstoreAddOutlined />}
              onClick={() => setIsSectionDrawerOpen(true)}
            />
          </Tooltip>
          <Tooltip title="Change Template" placement="left">
            <Button
              type="text"
              shape="circle"
              size="large"
              style={{ color: "#595959", fontSize: "20px" }}
              icon={<LayoutOutlined />}
              onClick={() => setEditingSection("templates")}
            />
          </Tooltip>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Tooltip title="Zoom In" placement="left">
                 <Button shape="circle" icon={<ZoomInOutlined />} onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} />
              </Tooltip>
              <Tooltip title="Zoom Out" placement="left">
                 <Button shape="circle" icon={<ZoomOutOutlined />} onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} />
              </Tooltip>
           </div>
           
           <Tooltip title={showPageBreaks ? "Hide Page Breaks" : "Show Page Breaks"} placement="left">
             <Button 
               shape="circle" 
               icon={<FileSearchOutlined />} 
               type={showPageBreaks ? "primary" : "default"}
               onClick={() => setShowPageBreaks(!showPageBreaks)} 
             />
           </Tooltip>

          <div style={{ width: "40%", height: "1px", background: "#f0f0f0" }} />

          {/* GROUP 2: AI TOOLS */}
          <Tooltip title="AI Assistant" placement="left">
            <Button
              shape="circle"
              size="large"
              style={{
                background: "linear-gradient(135deg, #e6fffb 0%, #E0F2F1 100%)",
                color: "#006d75",
                border: "none",
                boxShadow: "0 4px 10px rgba(0, 123, 123, 0.15)",
              }}
              icon={<MessageOutlined style={{ fontSize: "20px" }} />}
              onClick={() => setChatOpen(true)}
            />
          </Tooltip>

          <Tooltip title="ATS Audit" placement="left">
            <Button
              shape="circle"
              size="large"
              style={{
                 background: "#f9f0ff",
                 color: "#722ed1",
                 border: "none",
              }}
              icon={<SafetyCertificateOutlined style={{ fontSize: "20px" }} />}
              onClick={() => setAuditOpen(true)}
            />
          </Tooltip>

           <Tooltip title="Cover Letter" placement="left">
            <Button
              shape="circle"
              size="large"
              style={{
                 background: "#fff0f6",
                 color: "#eb2f96",
                 border: "none",
              }}
              icon={<FileTextOutlined style={{ fontSize: "20px" }} />}
              onClick={() => setCoverLetterOpen(true)}
            />
          </Tooltip>

          <div style={{ width: "40%", height: "1px", background: "#f0f0f0" }} />

          {/* GROUP 3: ACTIONS */}
          <Tooltip title="Save (Ctrl+S)" placement="left">
             <Button
              shape="circle"
              size="large"
              style={{
                color: isDirty ? "#faad14" : "#595959",
                borderColor: isDirty ? "#faad14" : "transparent"
              }}
              icon={isSaving ? <Spin size="small" /> : <SaveOutlined style={{ fontSize: "20px" }} />}
              onClick={handleSaveProfile}
            />
          </Tooltip>

          <Tooltip title="Share Link" placement="left">
            <Button
              type="text"
              shape="circle"
              size="large"
              style={{ color: "#13c2c2", fontSize: "20px" }}
              icon={<ShareAltOutlined />}
              onClick={() => {
                   if (!resume._id || isDirty) {
                     modal.confirm({
                       title: "Save Required",
                       content: "Please save your resume before sharing.",
                       okText: "Save",
                       onOk: handleSaveProfile
                     });
                   } else {
                     setShareModalOpen(true);
                   }
                }}
            />
          </Tooltip>

          <Tooltip title="Download PDF" placement="left">
            <Button
              type="primary"
              shape="circle"
              size="large"
              style={{
                backgroundColor: "#002A3A",
                width: "56px",
                height: "56px",
                boxShadow: "0 8px 20px rgba(0, 42, 58, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              icon={<DownloadOutlined style={{ fontSize: "24px" }} />}
              onClick={handleDownloadPDF}
            />
          </Tooltip>
        </div>

        {/* --- Drawers --- */}
        <Drawer
          title="Edit Section"
          placement="left"
          closable={true}
          onClose={() => setEditingSection(null)}
          open={!!editingSection}
          width={400}
          mask={false}
          style={{
            top: 64,
            bottom: 0,
            height: "auto",
            background: "#fff",
            boxShadow: "0 8px 10px -5px rgba(0,0,0,0.2)",
          }}
        >
          <SectionForms
            section={editingSection}
            resume={resume}
            onFormChange={handleFormChange}
            onListChange={handleListUpdate}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            onRefine={handleRefineExperience}
            onRefineSummary={handleRefineSummary}
            refiningId={refiningId}
            onTemplateChange={setSelectedDesign}
            // NEW PROP
            onMoveItem={handleMoveItem}
          />
        </Drawer>

        <Drawer
          title="Resume Sections"
          placement="right"
          closable={true}
          onClose={() => setIsSectionDrawerOpen(false)}
          open={isSectionDrawerOpen}
          width={320}
        >
          <Text type="secondary">
            Click a section to edit its content or add new items.
          </Text>
          <List
            itemLayout="horizontal"
            dataSource={sectionListData}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: "pointer", padding: "16px 8px" }}
                className="hover:bg-gray-100"
                onClick={() => openSectionFromList(item.key)}
              >
                <List.Item.Meta
                  avatar={item.icon}
                  title={<Link strong>{item.title}</Link>}
                />
              </List.Item>
            )}
          />
        </Drawer>
      </Layout>
    </>
  );
};

export default ResumeBuilder;
