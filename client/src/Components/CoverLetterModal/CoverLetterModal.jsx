import React, { useState } from 'react';
import { Modal, Input, Button, Typography, Spin, message, Alert } from 'antd';
import { FileTextOutlined, CopyOutlined, RobotOutlined } from '@ant-design/icons';
import { API_BASE_URL } from "../../Config/constraints";
import { useAuth } from "../../Context/context-definitions";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const CoverLetterModal = ({ open, onClose, resumeData }) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [jobDescription, setJobDescription] = useState('');
    const [result, setResult] = useState('');

    const handleGenerate = async () => {
        if (!jobDescription.trim()) return message.warning('Please paste a Job Description first.');
        
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/ai/cover-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ resumeData, jobDescription }),
            });
            const data = await response.json();
            
            if (data.success) {
                setResult(data.coverLetter);
            } else {
                message.error('Failed to generate letter.');
            }
        } catch (error) {
            console.error(error);
            message.error('Server Error.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(result);
        message.success('Copied to clipboard!');
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
            title={<span><RobotOutlined /> AI Cover Letter Writer</span>}
        >
            {!result ? (
                <div style={{ padding: '20px 0' }}>
                    <Title level={4}>Paste Job Description</Title>
                    <Paragraph type="secondary">
                        The AI will analyze your resume against this job description to write a tailored letter.
                    </Paragraph>
                    <TextArea 
                        rows={8} 
                        placeholder="Paste the full job description here..." 
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        style={{ marginBottom: 16 }}
                    />
                    <Button type="primary" size="large" block onClick={handleGenerate} loading={loading} icon={<FileTextOutlined />}>
                        Generate Cover Letter
                    </Button>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Title level={4} style={{ margin: 0 }}>Your Custom Cover Letter</Title>
                        <Button onClick={() => setResult('')}>Start Over</Button>
                    </div>
                    
                    <div style={{ 
                        background: '#f9f9f9', padding: '24px', borderRadius: '8px', 
                        border: '1px solid #eee', whiteSpace: 'pre-wrap', maxHeight: '500px', overflowY: 'auto' 
                    }}>
                        <Text>{result}</Text>
                    </div>

                    <Button type="primary" size="large" block style={{ marginTop: 16 }} onClick={handleCopy} icon={<CopyOutlined />}>
                        Copy to Clipboard
                    </Button>
                </div>
            )}
        </Modal>
    );
};

export default CoverLetterModal;