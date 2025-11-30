import React, { useEffect } from 'react';
import { Form, Input, Select, Typography, Row, Col, Upload, Avatar, Button, message } from 'antd';
import { UploadOutlined, UserOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import DynamicListEditor from './DynamicListEditor'; 
import { designOptions } from "../ResumePreview/ResumeDesigns";

const { Title, Text } = Typography;
const { Option } = Select;

export const SectionForms = ({
    section,
    resume,
    onFormChange,
    onListChange,
    onAddItem,
    onDeleteItem,
    onRefine,
    onRefineSummary,
    refiningId,
    onTemplateChange,
    onMoveItem 
}) => {
    
    const [personalForm] = Form.useForm();
    const [summaryForm] = Form.useForm();
    const [skillsForm] = Form.useForm();
    const [templateForm] = Form.useForm();

    // FIX: Force sync forms whenever resume data or the active section changes
    useEffect(() => {
        if (section === 'personal') {
            personalForm.setFieldsValue(resume.personal);
        }
        if (section === 'summary') {
            summaryForm.setFieldsValue({ summary: resume.summary });
        }
        if (section === 'skills') {
            skillsForm.setFieldsValue({ skills: resume.skills });
        }
        if (section === 'templates') {
            templateForm.setFieldsValue({ 
                template: resume.template || 'Classic',
                // If you implemented themeColor, sync it here too
            });
        }
    }, [resume, section, personalForm, summaryForm, skillsForm, templateForm]);

    // --- Image Upload Handler ---
    const handleImageUpload = (file) => {
        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isJpgOrPng) {
            message.error('You can only upload JPG/PNG file!');
            return Upload.LIST_IGNORE;
        }
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
            message.error('Image must be smaller than 2MB!');
            return Upload.LIST_IGNORE;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            onFormChange('personal', { profilePic: e.target.result });
        };
        reader.readAsDataURL(file);
        return false; 
    };

    const handleRemoveImage = (e) => {
        e.stopPropagation();
        onFormChange('personal', { profilePic: '' });
    };

    switch (section) {
        case 'personal':
            return (
                <Form 
                    form={personalForm} 
                    layout="vertical" 
                    initialValues={resume.personal} // FIX: Set initial values on mount
                    onValuesChange={(changed) => onFormChange('personal', changed)}
                    preserve={false} // FIX: Ensure fresh state on reopen
                >
                    <Title level={4}>Personal Information</Title>
                    
                    {/* Profile Picture Upload */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
                        <Upload
                            name="avatar"
                            showUploadList={false}
                            beforeUpload={handleImageUpload}
                            accept="image/png, image/jpeg"
                        >
                            <div style={{ position: 'relative', cursor: 'pointer' }} className="group">
                                <Avatar 
                                    size={84} 
                                    icon={<UserOutlined />} 
                                    src={resume.personal?.profilePic} 
                                    shape="square"
                                    style={{ border: '1px solid #d9d9d9' }}
                                />
                                <div style={{ 
                                    position: 'absolute', bottom: 0, right: 0, 
                                    background: '#007B7B', borderRadius: '4px 0 4px 0',
                                    padding: '2px 4px'
                                }}>
                                    <UploadOutlined style={{ color: '#fff', fontSize: '12px' }} />
                                </div>
                            </div>
                        </Upload>
                        
                        <div style={{ flex: 1 }}>
                            <Text strong>Profile Photo</Text>
                            <div style={{ marginTop: 4 }}>
                                <Upload 
                                    showUploadList={false} 
                                    beforeUpload={handleImageUpload}
                                    accept="image/png, image/jpeg"
                                >
                                    <Button size="small" icon={<UploadOutlined />}>Upload New</Button>
                                </Upload>
                                {resume.personal?.profilePic && (
                                    <Button 
                                        size="small" 
                                        danger 
                                        type="text" 
                                        icon={<DeleteOutlined />} 
                                        onClick={handleRemoveImage}
                                        style={{ marginLeft: 8 }}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                            <Text type="secondary" style={{ fontSize: '12px' }}>Max 2MB. JPG/PNG.</Text>
                        </div>
                    </div>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Full Name" name="name">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Professional Title" name="title">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Email" name="email">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Phone" name="phone">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="LinkedIn/Portfolio URL" name="linkedin">
                        <Input />
                    </Form.Item>
                    <Form.Item label="City, State" name="city">
                        <Input />
                    </Form.Item>
                </Form>
            );
        case 'summary':
            return (
                <Form 
                    form={summaryForm} 
                    layout="vertical" 
                    initialValues={{ summary: resume.summary }}
                    onValuesChange={(changed) => onFormChange('summary', changed)}
                    preserve={false}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Title level={4} style={{ margin: 0 }}>About Me</Title>
                        <Button 
                            type="dashed" 
                            icon={<ThunderboltOutlined />} 
                            onClick={onRefineSummary}
                            loading={refiningId === 'summary'}
                            style={{ color: '#007B7B', borderColor: '#007B7B' }}
                        >
                            AI Refine
                        </Button>
                    </div>
                    <Form.Item name="summary">
                        <Input.TextArea rows={15} placeholder="A brief, powerful summary..." />
                    </Form.Item>
                </Form>
            );
        case 'experience':
            return (
                <DynamicListEditor
                    title="Work Experience"
                    sectionName="experience"
                    items={resume.experience}
                    onUpdate={onListChange}
                    onAdd={() => onAddItem('experience')}
                    onDelete={onDeleteItem}
                    onRefine={onRefine}
                    refiningId={refiningId}
                    onMove={onMoveItem}
                />
            );
        case 'education':
            return (
                <DynamicListEditor
                    title="Education"
                    sectionName="education"
                    items={resume.education}
                    onUpdate={onListChange}
                    onAdd={() => onAddItem('education')}
                    onDelete={onDeleteItem}
                    onRefine={null}
                    onMove={onMoveItem}
                />
            );
        case 'skills':
            return (
                <Form 
                    form={skillsForm} 
                    layout="vertical" 
                    initialValues={{ skills: resume.skills }}
                    onValuesChange={(changed) => onFormChange('skills', changed)}
                    preserve={false}
                >
                    <Title level={4}>Skills</Title>
                    <Form.Item name="skills" label="Skills (Comma separated)">
                        <Input.TextArea rows={10} placeholder="e.g., JavaScript, React, Node.js..." />
                    </Form.Item>
                </Form>
            );
        case 'templates':
            return (
                <Form 
                    form={templateForm} 
                    layout="vertical"
                    initialValues={{ template: resume.template }}
                    onValuesChange={(changed) => onTemplateChange(changed.template)}
                    style={{ height: '100%' }}
                >
                    <Title level={4}>Select Template</Title>
                    <Form.Item name="template">
                        <Select
                            placeholder="Choose a new template"
                            style={{ width: '100%' }}
                            size="large"
                        >
                            {designOptions.map(option => (
                                <Option key={option.value} value={option.value}>
                                    {option.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            );
        default:
            return null;
    }
};