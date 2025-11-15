import React, { useEffect } from 'react';
import { Form, Input, Select, Typography, Row, Col } from 'antd';
import DynamicListEditor from './DynamicListEditor'; // The new one
import { designOptions } from "../ResumePreview/ResumeDesigns";

const { Title } = Typography;
const { Option } = Select;

/**
 * This component dynamically renders the correct form
 * based on which section the user is editing.
 */
export const SectionForms = ({
    section,
    resume,
    onFormChange,
    onListChange,
    onAddItem,
    onDeleteItem,
    onRefine,
    refiningId,
    onTemplateChange 
}) => {
    
    // We need to sync the forms with the main 'resume' state
    const [personalForm] = Form.useForm();
    const [summaryForm] = Form.useForm();
    const [skillsForm] = Form.useForm();
    const [templateForm] = Form.useForm();

    // Sync forms with the main state
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
    }, [resume, section, personalForm, summaryForm, skillsForm]);

    switch (section) {
        case 'personal':
            return (
                <Form 
                    form={personalForm} 
                    layout="vertical" 
                    onValuesChange={(changed) => onFormChange('personal', changed)}
                >
                    <Title level={4}>Personal Information</Title>
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
                    onValuesChange={(changed) => onFormChange('summary', changed)}
                >
                    <Title level={4}>Professional Summary</Title>
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
                />
            );
        case 'skills':
            return (
                <Form 
                    form={skillsForm} 
                    layout="vertical" 
                    onValuesChange={(changed) => onFormChange('skills', changed)}
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
                    onValuesChange={(changed) => onTemplateChange(changed.template)}
                >
                    <Title level={4}>Select Template</Title>
                    <Form.Item name="template">
                        <Select
                            placeholder="Choose a new template"
                            style={{ width: '100%' }}
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