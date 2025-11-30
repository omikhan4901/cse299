import React from 'react';
import { Modal, Input, Form, Button, Checkbox } from 'antd'; // Added Checkbox

const SaveResumeModal = ({ open, onCancel, onSave, loading, initialNickname }) => {
    const [form] = Form.useForm();

    const handleOk = () => {
        form.validateFields()
            .then(values => {
                // Pass both nickname AND the isMaster checkbox value
                onSave(values.nickname, values.isMaster);
            })
            .catch(info => {
                console.log('Validate Failed:', info);
            });
    };

    return (
        <Modal
            title="Save Resume"
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>Cancel</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
                    Save Resume
                </Button>,
            ]}
        >
            <Form
                form={form}
                layout="vertical"
                name="save_resume_form"
                initialValues={{ 
                    nickname: initialNickname || '',
                    isMaster: false // Default unchecked
                }}
            >
                <Form.Item
                    name="nickname"
                    label="Resume Name (Nickname)"
                    rules={[{ required: true, message: 'Please give your resume a name!' }]}
                >
                    <Input placeholder="e.g. Full Stack Application..." />
                </Form.Item>

                {/* NEW CHECKBOX */}
                <Form.Item name="isMaster" valuePropName="checked">
                    <Checkbox>Set as <b>Master Profile</b> (Auto-fill source)</Checkbox>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default SaveResumeModal;