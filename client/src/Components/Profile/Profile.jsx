import React, { useEffect, useState } from 'react';
import { 
    Layout, 
    Typography, 
    Card, 
    Button, 
    Row, 
    Col, 
    Spin, 
    Empty, 
    Modal, 
    message, 
    Tag, 
    Badge, 
    Tooltip, 
    Divider 
} from 'antd';
import { 
    PlusOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    FileTextOutlined, 
    ClockCircleOutlined,
    CrownFilled,
    CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth, useRouter } from "../../Context/context-definitions";
import { API_BASE_URL } from "../../Config/constraints";

const { Title, Text } = Typography;
const { Meta } = Card;

const ProfilePage = () => {
    const { token, user } = useAuth();
    const { navigate } = useRouter();
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Ant Design Hooks
    const [modal, modalContextHolder] = Modal.useModal();
    const [messageApi, messageContextHolder] = message.useMessage();

    useEffect(() => {
        if (token) fetchResumes();
    }, [token]);

    const fetchResumes = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/resumes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setResumes(data.data);
            } else {
                messageApi.error("Failed to fetch resumes.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        modal.confirm({
            title: 'Delete this resume?',
            content: 'This action cannot be undone.',
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/resumes/${id}`, {
                        method: 'DELETE',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();

                    if (data.success) {
                        messageApi.success('Resume deleted successfully');
                        setResumes(prev => prev.filter(r => r._id !== id));
                    } else {
                        messageApi.error(data.error || 'Delete failed');
                    }
                } catch (err) {
                    console.error(err);
                    messageApi.error('Server error during delete.');
                }
            }
        });
    };

    const handleEdit = (resume) => {
        localStorage.setItem('currentResumeId', resume._id);
        navigate('/builder');
    };

    const handleCreateNew = () => {
        localStorage.removeItem('currentResumeId');
        navigate('/builder');
    };

    // Sort: Master First, then by Date Updated
    const sortedResumes = [...resumes].sort((a, b) => {
        if (a.isMaster === b.isMaster) {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        }
        return a.isMaster ? -1 : 1;
    });

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Spin size="large" tip="Loading Profiles..." />
            </div>
        );
    }

    return (
        <Layout style={{ minHeight: 'calc(100vh - 64px)', background: '#f8fafc', padding: '40px 24px' }}>
            
            {modalContextHolder}
            {messageContextHolder}

            <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
                
                {/* --- Page Header --- */}
                <div style={{ 
                    marginBottom: 48, 
                    textAlign: 'center', 
                    background: '#fff', 
                    padding: '40px', 
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    border: '1px solid #f0f0f0'
                }}>
                    <Title level={2} style={{ color: '#002A3A', marginBottom: 8 }}>
                        My Resume Portfolio
                    </Title>
                    <Text type="secondary" style={{ fontSize: '16px', maxWidth: '600px', display: 'block', margin: '0 auto 24px' }}>
                        Manage your different resume versions. Set a <b>Master Profile</b> to auto-fill new resumes instantly.
                    </Text>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<PlusOutlined />} 
                        onClick={handleCreateNew}
                        style={{ height: '48px', padding: '0 32px', fontSize: '16px', borderRadius: '8px' }}
                    >
                        Create New Resume
                    </Button>
                </div>

                {/* --- Content Grid --- */}
                {sortedResumes.length === 0 ? (
                    <Empty
                        image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
                        imageStyle={{ height: 120 }}
                        description={
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                <Text style={{ fontSize: '16px', color: '#666' }}>
                                    You haven't created any resumes yet.
                                </Text>
                                <Button type="dashed" onClick={handleCreateNew}>Get Started Now</Button>
                            </div>
                        }
                    />
                ) : (
                    <>
                        <Divider orientation="left" style={{ borderColor: '#d9d9d9' }}>
                            <span style={{ color: '#888', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Documents</span>
                        </Divider>
                        
                        <Row gutter={[24, 24]}>
                            {sortedResumes.map(resume => (
                                <Col xs={24} sm={12} md={8} key={resume._id}>
                                    
                                    {/* Wrapper for the Ribbon Logic */}
                                    <div className="h-full">
                                        {resume.isMaster ? (
                                            <Badge.Ribbon 
                                                text={<span className="flex items-center gap-1"><CrownFilled /> Master Source</span>} 
                                                color="#007B7B"
                                            >
                                                <ResumeCard 
                                                    resume={resume} 
                                                    onEdit={handleEdit} 
                                                    onDelete={handleDelete} 
                                                    isMaster={true}
                                                />
                                            </Badge.Ribbon>
                                        ) : (
                                            <ResumeCard 
                                                resume={resume} 
                                                onEdit={handleEdit} 
                                                onDelete={handleDelete} 
                                                isMaster={false}
                                            />
                                        )}
                                    </div>

                                </Col>
                            ))}
                        </Row>
                    </>
                )}
            </div>
        </Layout>
    );
};

// --- Sub-Component for Clean Card Design ---
const ResumeCard = ({ resume, onEdit, onDelete, isMaster }) => {
    return (
        <Card
            hoverable
            style={{ 
                height: '100%', 
                borderRadius: '12px', 
                border: isMaster ? '1px solid #007B7B' : '1px solid #f0f0f0',
                boxShadow: isMaster ? '0 4px 15px rgba(0, 123, 123, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease'
            }}
            styles={{ body: { padding: '24px' } }}
            actions={[
                <Tooltip title="Edit Resume">
                    <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(resume)} block />
                </Tooltip>,
                <Tooltip title="Delete">
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => onDelete(e, resume._id)} block />
                </Tooltip>
            ]}
        >
            <Meta
                avatar={
                    <div style={{ 
                        backgroundColor: isMaster ? '#007B7B' : '#f0f5ff', 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '10px',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: isMaster ? '#fff' : '#1890ff',
                        fontSize: '22px'
                    }}>
                        {isMaster ? <CrownFilled /> : <FileTextOutlined />}
                    </div>
                }
                title={
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{ fontSize: '16px', color: '#1f1f1f' }} ellipsis={{ tooltip: resume.nickname }}>
                            {resume.nickname}
                        </Text>
                        {isMaster && <Text style={{ fontSize: '11px', color: '#007B7B' }}>Primary Data Source</Text>}
                    </div>
                }
                description={
                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <Tag color={isMaster ? "cyan" : "blue"} style={{ margin: 0 }}>
                                {resume.template || 'Classic'}
                            </Tag>
                            {resume.personal?.profilePic && (
                                <Tag color="green" icon={<CheckCircleOutlined />}>Photo</Tag>
                            )}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClockCircleOutlined /> 
                            Updated {new Date(resume.updatedAt).toLocaleDateString()}
                        </Text>
                    </div>
                }
            />
        </Card>
    );
};

export default ProfilePage;