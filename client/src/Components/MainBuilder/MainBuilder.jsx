import React, { useState, useEffect } from 'react';
import { useAuth, useRouter } from "../../Context/context-definitions";
import { 
    Layout, 
    FloatButton, 
    Modal, 
    Spin, 
    Alert,
    Drawer,
    Upload,
    Button,
    Space,
    Typography,
    notification,
    Card,
    List
} from 'antd';
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
    BookOutlined
} from '@ant-design/icons';

// PDF libraries removed

import ResumeDesigns from "../ResumePreview/ResumeDesigns";
import ChatModal from "../AiChat/AiChat";
import { SectionForms } from './SectionForms';
import { initialResumeState, API_BASE_URL } from "../../Config/constraints";

const { Content } = Layout;
const { Title, Text, Link } = Typography;

// --- Main Builder Component ---

const ResumeBuilder = () => {
    const { user, loading: authLoading, token } = useAuth();
    const { navigate } = useRouter();
    
    // --- State ---
    const [resume, setResume] = useState(initialResumeState);
    const [refiningId, setRefiningId] = useState(null); 
    const [chatOpen, setChatOpen] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [selectedDesign, setSelectedDesign] = useState('Classic');
    const [editingSection, setEditingSection] = useState(null); 
    const [isSaving, setIsSaving] = useState(false);
    
    // isDownloadingPDF state removed
    
    const [api, contextHolder] = notification.useNotification();
    const [isSectionDrawerOpen, setIsSectionDrawerOpen] = useState(false);

    // --- Handlers (Simplified) ---
    useEffect(() => {
        if (!authLoading && !user) navigate('/');
    }, [authLoading, user, navigate]);
    const handleFormChange = (section, changedValues) => {
        if (section === 'summary' || section === 'skills') {
            setResume(prev => ({ ...prev, ...changedValues }));
        } else {
            setResume(prev => ({ ...prev, [section]: { ...prev[section], ...changedValues } }));
        }
    };
    const handleListUpdate = (section, id, field, value) => {
        setResume(prev => ({
            ...prev,
            [section]: prev[section].map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };
    const handleAddItem = (section) => {
        const newEntry = section === 'experience'
            ? { id: Date.now(), company: '', title: '', startDate: '', endDate: '', description: '' }
            : { id: Date.now(), institution: '', degree: '', startYear: '', endYear: '' };
        setResume(prev => ({ ...prev, [section]: [...prev[section], newEntry] }));
    };
    const handleDeleteItem = (section, id) => {
        setResume(prev => ({ ...prev, [section]: prev[section].filter(item => item.id !== id) }));
    };
    const handleRefineExperience = async (itemId, originalText) => {
        if (!token) return navigate('/');
        setRefiningId(itemId);
        try {
            const response = await fetch(`${API_BASE_URL}/ai/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ resumeText: originalText }),
            });
            const data = await response.json();
            if (data.success && data.refinedText) {
                handleListUpdate('experience', itemId, 'description', data.refinedText);
                api.success({ message: 'Content Refined', placement: 'topRight' });
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            api.error({ message: 'Refine Failed', description: error.message, placement: 'topRight' });
        } finally {
            setRefiningId(null);
        }
    };
    const handleChatSave = (newText) => {
        setResume(prev => ({ ...prev, summary: newText }));
        setChatOpen(false);
    };
    const handleParseResume = async (options) => {
        const { file } = options;
        if (!token) return navigate('/');
        setUploadError(null);
        setUploadLoading(true);
        try {
            const formData = new FormData();
            formData.append('resumeFile', file);
            const response = await fetch(`${API_BASE_URL}/ai/parse`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const data = await response.json();
            if (data.success && data.extractedData) {
                const extracted = data.extractedData;
                const mappedData = {
                    personal: extracted.personal || initialResumeState.personal,
                    summary: extracted.summary || '',
                    experience: (extracted.experience || []).map((item, index) => ({ 
                        ...item, id: Date.now() + index, description: item.description || '' 
                    })),
                    education: (extracted.education || []).map((item, index) => ({ 
                        ...item, id: Date.now() + index + 100 
                    })),
                    skills: extracted.skills || '',
                };
                setResume(mappedData);
                api.success({ message: 'Resume Parsed!', placement: 'topRight' });
            } else {
                throw new Error(data.error || 'Could not extract valid data');
            }
        } catch (error) {
            setUploadError(error.message);
            api.error({ message: 'Parse Failed', description: error.message, placement: 'topRight' });
        } finally {
            setUploadLoading(false);
        }
    };

    // --- REVERTED `handleDownloadPDF` FUNCTION ---
    const handleDownloadPDF = () => { 
        api.info({ 
            message: 'Opening Print Dialog...', 
            description: 'Please use your browser\'s print-to-PDF function.', 
            placement: 'topRight' 
        });
        // Back to the simple (but flaky) window.print
        window.print(); 
    };
    // --- END of reverted function ---

    const handleSaveProfile = () => {
        setIsSaving(true);
        console.log("Saving profile...", resume);
        api.info({ message: 'Saving profile...', placement: 'topRight' });
        setTimeout(() => {
            setIsSaving(false);
            api.success({ message: 'Profile Saved!', placement: 'topRight' });
        }, 1500);
    };

    const sectionListData = [
        { title: 'Personal Info', key: 'personal', icon: <UserOutlined /> },
        { title: 'Summary', key: 'summary', icon: <FileTextOutlined /> },
        { title: 'Experience', key: 'experience', icon: <ThunderboltOutlined /> },
        { title: 'Education', key: 'education', icon: <BookOutlined /> },
        { title: 'Skills', key: 'skills', icon: <SettingOutlined /> },
    ];

    const openSectionFromList = (sectionKey) => {
        setIsSectionDrawerOpen(false);
        setEditingSection(sectionKey);
    };

    if (authLoading || !user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            </div>
        );
    }

    return (
        <> 
            {contextHolder} 
            <Layout style={{ minHeight: 'calc(100vh - 64px)', background: '#f0f2f5' }}>
                
                <ChatModal 
                    resumeText={resume.summary} 
                    onSave={handleChatSave} 
                    onClose={() => setChatOpen(false)}
                    open={chatOpen}
                />

                <Content style={{ 
                    padding: '24px', 
                    paddingLeft: editingSection ? '424px' : '24px',
                    transition: 'padding-left 0.3s ease-in-out'
                }}>
                    
                    <Card style={{ marginBottom: 24, background: '#fff' }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Title level={4}>AI Resume Parser</Title>
                            <Text>Start by uploading an existing resume (PDF/DOCX)</Text>
                            <Upload 
                                customRequest={handleParseResume}
                                showUploadList={false}
                                disabled={uploadLoading}
                            >
                                <Button icon={<UploadOutlined />} loading={uploadLoading}>
                                    {uploadLoading ? 'Parsing...' : 'Upload Resume'}
                                </Button>
                            </Upload>
                            {uploadError && <Alert message={uploadError} type="error" showIcon />}
                        </Space>
                    </Card>
                    
                    <ResumeDesigns 
                        data={resume} 
                        selectedDesign={selectedDesign} 
                        onEditSection={setEditingSection} 
                    />
                </Content>

                <Drawer
                    title="Edit Section"
                    placement="left"
                    closable={true}
                    onClose={() => setEditingSection(null)}
                    open={!!editingSection}
                    width={400}
                    mask={false} 
                    style={{
                        height: 'calc(100vh - 64px)',
                        top: 64,
                        background: '#fff',
                        boxShadow: '0 8px 10px -5px rgba(0,0,0,0.2)'
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
                        refiningId={refiningId}
                        onTemplateChange={setSelectedDesign}
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
                                style={{ cursor: 'pointer', padding: '16px 8px' }}
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

                <FloatButton.Group
                    trigger="hover"
                    type="primary"
                    style={{ right: 24 }}
                    icon={<SettingOutlined />}
                >
                    <FloatButton 
                        icon={<AppstoreAddOutlined />} 
                        tooltip="Add/View Sections"
                        onClick={() => setIsSectionDrawerOpen(true)} 
                    />
                    <FloatButton 
                        icon={<DownloadOutlined />} 
                        tooltip="Download PDF (Print)"
                        onClick={handleDownloadPDF} 
                    />
                    <FloatButton 
                        icon={<LayoutOutlined />} 
                        tooltip="Change Template"
                        onClick={() => setEditingSection('templates')}
                    />
                    <FloatButton 
                        icon={<MessageOutlined />} 
                        tooltip="AI Summary Chat"
                        onClick={() => setChatOpen(true)}
                    />
                    <FloatButton 
                        icon={isSaving ? <Spin /> : <SaveOutlined />} 
                        tooltip="Save Profile"
                        onClick={handleSaveProfile}
                    />
                </FloatButton.Group>
            </Layout>
        </>
    );
};

export default ResumeBuilder;