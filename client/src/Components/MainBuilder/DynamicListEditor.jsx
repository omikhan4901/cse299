import React from 'react';
import { 
    Collapse, 
    Form, 
    Input, 
    Button, 
    Row, 
    Col, 
    Space, 
    Tooltip,
    Typography,
    Popconfirm
} from 'antd';
import { 
    PlusOutlined, 
    DeleteOutlined, 
    ThunderboltOutlined 
} from '@ant-design/icons';

const { Panel } = Collapse;
const { Text, Title } = Typography;

/**
 * An intuitive, Collapse-based list editor for Experience and Education.
 * Each item in the list is its own form, providing instant updates.
 */
const DynamicListEditor = ({ 
    title, 
    sectionName, 
    items, 
    onAdd, 
    onUpdate, 
    onDelete, 
    onRefine, 
    refiningId 
}) => {
    
    // We need a form instance *for each panel*
    const [formInstances] = Form.useForm();
    
    // Renders the correct form fields *inside* the collapse panel
    const renderFields = (item) => {
        
        // This handler is called on *every key press* in this item's form
        const handleFormChange = (changedValues) => {
            const fieldName = Object.keys(changedValues)[0];
            const value = changedValues[fieldName];
            onUpdate(sectionName, item.id, fieldName, value);
        };

        if (sectionName === 'experience') {
            return (
                <Form 
                    layout="vertical" 
                    onValuesChange={handleFormChange}
                    initialValues={item}
                    // Stop the event from bubbling up and closing the panel
                    onClick={(e) => e.stopPropagation()} 
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Title" name="title">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Company" name="company">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Start Date (YYYY-MM)" name="startDate">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="End Date (YYYY-MM/Present)" name="endDate">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Description (Bullet Points)" name="description">
                        <Input.TextArea rows={5} />
                    </Form.Item>
                </Form>
            );
        }
        
        if (sectionName === 'education') {
            return (
                <Form 
                    layout="vertical" 
                    onValuesChange={handleFormChange}
                    initialValues={item}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Institution" name="institution">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Degree / Field of Study" name="degree">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Start Year" name="startYear">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="End Year" name="endYear">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            );
        }
        return null;
    };

    // Creates the header for each panel (e.g., "Lead Engineer at Google")
    const getPanelHeader = (item) => {
        if (sectionName === 'experience') {
            return item.title || "New Experience Entry";
        }
        if (sectionName === 'education') {
            return item.degree || "New Education Entry";
        }
        return "New Entry";
    };

    // Creates the action buttons (Delete, AI Refine) for each panel
    const getPanelExtra = (item) => (
        <Space onClick={(e) => e.stopPropagation()}>
            {onRefine && (
                <Tooltip title="Refine with AI">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<ThunderboltOutlined />}
                        loading={refiningId === item.id}
                        disabled={refiningId && refiningId !== item.id}
                        onClick={() => onRefine(item.id, item.description)}
                    />
                </Tooltip>
            )}
            <Popconfirm
                title="Delete this entry?"
                onConfirm={() => onDelete(sectionName, item.id)} // Pass sectionName
                okText="Delete"
                cancelText="Cancel"
            >
                <Tooltip title="Delete">
                    <Button
                        type="text"
                        danger
                        shape="circle"
                        icon={<DeleteOutlined />}
                        disabled={refiningId}
                    />
                </Tooltip>
            </Popconfirm>
        </Space>
    );

    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>{title}</Title>
            <Text type="secondary" style={{ marginBottom: 16 }}>
                Click an item to edit, or add a new one.
            </Text>
            <Collapse 
                ghost
                accordion
                style={{ width: '100%' }}
            >
                {items.map(item => (
                    <Panel
                        header={getPanelHeader(item)}
                        key={item.id}
                        extra={getPanelExtra(item)}
                    >
                        {renderFields(item)}
                    </Panel>
                ))}
            </Collapse>
            <Button
                type="dashed"
                onClick={() => onAdd(sectionName)} // Pass sectionName
                icon={<PlusOutlined />}
                style={{ width: '100%', marginTop: 16 }}
            >
                Add {sectionName === 'experience' ? 'Experience' : 'Education'}
            </Button>
        </Space>
    );
};

export default DynamicListEditor;