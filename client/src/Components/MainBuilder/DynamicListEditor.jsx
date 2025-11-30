import React, { useEffect } from 'react';
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
    ThunderboltOutlined,
    ArrowUpOutlined,    
    ArrowDownOutlined   
} from '@ant-design/icons';

const { Text, Title } = Typography;

// --- Sub-Component for individual list items (Ensure this is correct and uses form.setFieldsValue(item) in useEffect) ---
const ListFormItem = ({ item, sectionName, onUpdate }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        form.setFieldsValue(item);
    }, [item, form]);

    const handleFormChange = (changedValues) => {
        const fieldName = Object.keys(changedValues)[0];
        const value = changedValues[fieldName];
        onUpdate(sectionName, item.id, fieldName, value);
    };

    if (sectionName === 'experience') {
        return (
            <Form 
                form={form} 
                layout="vertical" 
                onValuesChange={handleFormChange}
                initialValues={item}
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Title" name="title"><Input /></Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Company" name="company"><Input /></Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Start Date (YYYY-MM)" name="startDate"><Input /></Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="End Date (YYYY-MM/Present)" name="endDate"><Input /></Form.Item>
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
                form={form}
                layout="vertical" 
                onValuesChange={handleFormChange}
                initialValues={item}
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Institution" name="institution"><Input /></Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Degree / Field of Study" name="degree"><Input /></Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Start Year" name="startYear"><Input /></Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="End Year" name="endYear"><Input /></Form.Item>
                    </Col>
                </Row>
            </Form>
        );
    }
    return null;
};
// --- END ListFormItem ---


const DynamicListEditor = ({ 
    title, 
    sectionName, 
    items, 
    onAdd, // <--- This is the key prop
    onUpdate, 
    onDelete, 
    onRefine, 
    onMove, 
    refiningId 
}) => {
    
    const getPanelHeader = (item) => {
        if (sectionName === 'experience') return item.title || "New Experience Entry";
        if (sectionName === 'education') return item.degree || "New Education Entry";
        return "New Entry";
    };

    const getPanelExtra = (item, index) => (
        <Space onClick={(e) => e.stopPropagation()}>
            
            {/* Move Up/Down Buttons */}
            {onMove && (
                <>
                <Tooltip title="Move Up">
                    <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMove(sectionName, index, 'up')} />
                </Tooltip>
                <Tooltip title="Move Down">
                    <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={index === items.length - 1} onClick={() => onMove(sectionName, index, 'down')} />
                </Tooltip>
                </>
            )}

            {/* AI Refine Button */}
            {onRefine && (
                <Tooltip title="Refine description with AI">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<ThunderboltOutlined />}
                        loading={refiningId === item.id}
                        style={{ color: refiningId === item.id ? '#1890ff' : undefined }}
                        onClick={() => onRefine(item.id, item.description)}
                    />
                </Tooltip>
            )}

            {/* Delete Button */}
            <Popconfirm
                title="Delete this entry?"
                onConfirm={() => onDelete(sectionName, item.id)}
                okText="Delete"
                cancelText="Cancel"
            >
                <Button type="text" danger shape="circle" icon={<DeleteOutlined />} disabled={refiningId} />
            </Popconfirm>
        </Space>
    );

    const collapseItems = items.map((item, index) => ({
        key: item.id,
        label: getPanelHeader(item),
        extra: getPanelExtra(item, index), 
        children: (
            <ListFormItem 
                item={item} 
                sectionName={sectionName} 
                onUpdate={onUpdate} 
            />
        )
    }));

    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>{title}</Title>
            <Text type="secondary" style={{ marginBottom: 16 }}>
                Click an item to edit, or add a new one.
            </Text>
            
            {/* Collapse List */}
            <Collapse 
                ghost 
                accordion 
                items={collapseItems} 
                style={{ width: '100%' }}
            />

            {/* --- THE MISSING ADD BUTTON --- */}
            <Button
                type="dashed"
                onClick={() => onAdd(sectionName)} // Calls handleAddItem in MainBuilder
                icon={<PlusOutlined />}
                style={{ width: '100%', marginTop: 16 }}
            >
                Add {sectionName === 'experience' ? 'Experience' : 'Education'} Entry
            </Button>
        </Space>
    );
};

export default DynamicListEditor;