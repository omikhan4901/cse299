import React, { useState, useEffect } from 'react';
import { Modal, Progress, Typography, List, Alert, Button, Spin, Input, Divider } from 'antd';
import { CheckCircleOutlined, WarningOutlined, FileSearchOutlined, AimOutlined } from '@ant-design/icons';
import { API_BASE_URL } from "../../Config/constraints";
import { useAuth } from "../../Context/context-definitions";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;


const AiAuditModal = ({ open, onClose, resumeData }) => {
    const { token } = useAuth();
    
    // Steps: 'input' -> 'loading' -> 'results'
    const [step, setStep] = useState('input');
    const [jobDescription, setJobDescription] = useState('');
    const [analysis, setAnalysis] = useState(null);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setStep('input');
            setJobDescription('');
            setAnalysis(null);
        }
    }, [open]);

    const runAudit = async () => {
        setStep('loading');
        try {
            const isTargeted = jobDescription.trim().length > 0;

            const auditPrompt = `
                ACT AS AN ATS SCANNER and Career Coach. 
                
                ${isTargeted ? `I am applying for this job:\n"${jobDescription}"` : "Perform a general resume audit for a Full Stack Developer role."}

                Analyze this resume JSON:
                ${JSON.stringify(resumeData)}

                Provide a JSON response with this EXACT structure (no markdown formatting):
                {
                    "score": number (0-100 based on ${isTargeted ? 'match with job description' : 'general best practices'}),
                    "summary": "Short 1-sentence verdict.",
                    "strengths": ["point 1", "point 2"],
                    "improvements": ["critical fix 1", "critical fix 2", "critical fix 3"],
                    "missingKeywords": ["keyword1", "keyword2"] 
                }
            `;

            const response = await fetch(`${API_BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    conversation: [{ role: 'user', content: auditPrompt }], 
                    fullResume: resumeData 
                }),
            });
            
            const data = await response.json();
            if (data.success) {
                const cleanJson = data.response.replace(/```json|```/g, '').trim();
                setAnalysis(JSON.parse(cleanJson));
                setStep('results');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error(error);
            setStep('error');
        }
    };

    // --- RENDER HELPERS ---

    const renderInputStep = () => (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <FileSearchOutlined style={{ fontSize: '48px', color: '#007B7B', marginBottom: 16 }} />
            <Title level={3}>Tailor Your Resume</Title>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                Paste the <b>Job Description</b> you are applying for. <br/>
                Our AI will compare your resume against it and find missing keywords.
            </Paragraph>
            
            <TextArea 
                rows={6} 
                placeholder="Paste Job Description here (e.g. 'We are looking for a React Developer with AWS experience...')" 
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                style={{ marginBottom: 24, borderRadius: 8 }}
            />

            <Button 
                type="primary" 
                size="large" 
                block 
                onClick={runAudit}
                icon={<AimOutlined />}
                style={{ height: 48, fontSize: 16 }}
            >
                {jobDescription.trim() ? 'Scan for Job Match' : 'Skip & Run General Audit'}
            </Button>
        </div>
    );

    const renderLoadingStep = () => (
        <div className="text-center py-12">
            <Spin size="large" />
            <div style={{ marginTop: 24 }}>
                <Title level={4}>Scanning...</Title>
                <Paragraph>Analyzing keywords, formatting, and ATS compatibility.</Paragraph>
            </div>
        </div>
    );

    const renderResultsStep = () => (
        <div>
            <div className="text-center mb-8">
                <Progress 
                    type="circle" 
                    percent={analysis.score} 
                    format={(percent) => <span className="text-3xl font-bold">{percent}</span>}
                    strokeColor={analysis.score > 75 ? '#52c41a' : analysis.score > 50 ? '#faad14' : '#ff4d4f'}
                    size={120}
                />
                <Title level={4} style={{ marginTop: 16 }}>
                    {jobDescription ? 'Job Match Score' : 'Resume Health Score'}
                </Title>
                <Text type="secondary">{analysis.summary}</Text>
            </div>

            {/* Missing Keywords (Only show if relevant) */}
            {analysis.missingKeywords && analysis.missingKeywords.length > 0 && (
                <Alert
                    message="Missing Keywords"
                    description={
                        <div style={{ marginTop: 8 }}>
                            <Paragraph style={{ marginBottom: 8 }}>Add these to your skills or experience to pass the ATS:</Paragraph>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {analysis.missingKeywords.map(kw => (
                                    <span key={kw} style={{ background: '#fff1f0', border: '1px solid #ffa39e', color: '#cf1322', padding: '2px 8px', borderRadius: 4, fontSize: '12px' }}>
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <List
                header={<div className="font-bold text-green-600"><CheckCircleOutlined /> Strengths</div>}
                dataSource={analysis.strengths}
                renderItem={(item) => <List.Item className="py-2"><Text>{item}</Text></List.Item>}
                size="small"
                bordered
                style={{ marginBottom: 16, backgroundColor: '#f6ffed' }}
            />

            <List
                header={<div className="font-bold text-orange-600"><WarningOutlined /> Improvements</div>}
                dataSource={analysis.improvements}
                renderItem={(item) => <List.Item className="py-2"><Text>{item}</Text></List.Item>}
                size="small"
                bordered
                style={{ backgroundColor: '#fffbe6' }}
            />
            
            <Button type="default" block size="large" onClick={() => setStep('input')} style={{ marginTop: 24 }}>
                Scan Another Job
            </Button>
        </div>
    );

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={600}
            destroyOnHidden
        >
            {step === 'input' && renderInputStep()}
            {step === 'loading' && renderLoadingStep()}
            {step === 'results' && renderResultsStep()}
            {step === 'error' && <Alert message="Analysis Failed" description="Please try again." type="error" />}
        </Modal>
    );
};

export default AiAuditModal;