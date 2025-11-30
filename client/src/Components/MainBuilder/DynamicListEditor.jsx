import React, { useEffect } from "react";
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
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined, // NEW
  ArrowDownOutlined, // NEW
} from "@ant-design/icons";
const { Text, Title } = Typography;

// --- Sub-Component for individual list items ---
const ListFormItem = ({ item, sectionName, onUpdate }) => {
  const [form] = Form.useForm();

  // Sync form with item data (e.g. when AI updates it)
  useEffect(() => {
    form.setFieldsValue(item);
  }, [item, form]);

  const handleFormChange = (changedValues) => {
    const fieldName = Object.keys(changedValues)[0];
    const value = changedValues[fieldName];
    onUpdate(sectionName, item.id, fieldName, value);
  };

  if (sectionName === "experience") {
    return (
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        initialValues={item}
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
            <Form.Item label="Start Date" name="startDate">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="End Date" name="endDate">
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

  if (sectionName === "education") {
    return (
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        initialValues={item}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Institution" name="institution">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Degree" name="degree">
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
const DynamicListEditor = ({ 
    title, 
    sectionName, 
    items, 
    onAdd, 
    onUpdate, 
    onDelete, 
    onRefine, 
    onMove, // <--- Receive prop
    refiningId 
}) => {
    
    const getPanelHeader = (item) => {
        if (sectionName === 'experience') return item.title || "New Experience Entry";
        if (sectionName === 'education') return item.degree || "New Education Entry";
        return "New Entry";
    };

    // Helper to generate the buttons for a specific item at a specific index
    const getPanelExtra = (item, index) => (
        <Space onClick={(e) => e.stopPropagation()}>
            
            {/* --- MOVE UP BUTTON --- */}
            {onMove && (
                <Tooltip title="Move Up">
                    <Button 
                        type="text" 
                        size="small" 
                        icon={<ArrowUpOutlined />} 
                        disabled={index === 0} // Disable if first item
                        onClick={() => onMove(sectionName, index, 'up')}
                    />
                </Tooltip>
            )}

            {/* --- MOVE DOWN BUTTON --- */}
            {onMove && (
                <Tooltip title="Move Down">
                    <Button 
                        type="text" 
                        size="small" 
                        icon={<ArrowDownOutlined />} 
                        disabled={index === items.length - 1} // Disable if last item
                        onClick={() => onMove(sectionName, index, 'down')}
                    />
                </Tooltip>
            )}

            {/* Divider or just space */}
            
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

    // Update map to use index
    const collapseItems = items.map((item, index) => ({
        key: item.id,
        label: getPanelHeader(item),
        extra: getPanelExtra(item, index), // Pass index here
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
            {/* ... title and text ... */}
            
            <Collapse 
                ghost 
                accordion 
                items={collapseItems} 
                style={{ width: '100%' }}
            />

            {/* ... Add button ... */}
        </Space>
    );
};

export default DynamicListEditor;