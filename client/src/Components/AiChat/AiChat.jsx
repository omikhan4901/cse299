import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../Context/context-definitions";
import { Modal, Input, Button, Space, Spin, Typography } from 'antd';
import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { API_BASE_URL } from "../../Config/constraints";

const { Paragraph } = Typography;

// CHANGE: Accept 'resumeData' instead of just 'resumeText'
const ChatModal = ({ resumeData, onSave, onClose, open }) => {
    const { token } = useAuth();
    const [conversation, setConversation] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatRef = useRef(null);

    useEffect(() => {
        if (open) {
            // Context-aware greeting
            const greeting = resumeData?.personal?.name 
                ? `Hello ${resumeData.personal.name}! I have read your resume. I can help you write a summary, improve your bullet points, or suggest missing skills. What shall we do?`
                : "Hello! I'm your AI assistant. I've loaded your resume context. How can I help?";

            setConversation([{ role: 'assistant', content: greeting }]);
            setInput('');
        }
    }, [open, resumeData]); // React to resumeData changes

    const handleSend = async () => {
        if (!input.trim() || loading || !token) return;

        const newUserMessage = { role: 'user', content: input.trim() };
        setConversation(prev => [...prev, newUserMessage]);
        setInput('');
        setLoading(true);

        const payload = {
            conversation: [...conversation, newUserMessage], 
            fullResume: resumeData, // SEND FULL DATA
        };

        try {
            const response = await fetch(`${API_BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (data.success && data.response) {
                setConversation(prev => [...prev, { role: 'assistant', content: data.response }]);
            } else {
                throw new Error(data.error || 'Failed to get AI response.');
            }
        } catch (error) {
            setConversation(prev => [...prev, { role: 'assistant', content: `[ERROR] ${error.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    // ... (Keep Auto-scroll, handleSaveSuggestion, and render logic same as before)
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [conversation]);

    const handleSaveSuggestion = (text) => {
        // Simple heuristic to remove quotes if the AI adds them
        const cleanText = text.replace(/^"|"$/g, '');
        
        Modal.confirm({
            title: 'Save AI Suggestion?',
            content: (
                <Paragraph ellipsis={{ rows: 5, expandable: true }}>
                    {cleanText}
                </Paragraph>
            ),
            okText: "Save to Summary",
            onOk: () => onSave(cleanText),
        });
    };

    return (
        <Modal
            title="AI Resume Consultant"
            open={open}
            onCancel={onClose}
            width={700}
            footer={null} 
        >
            <div 
                ref={chatRef} 
                style={{ 
                    height: '50vh', 
                    overflowY: 'auto', 
                    padding: '16px', 
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}
            >
                {conversation.map((msg, index) => (
                    <div 
                        key={index} 
                        style={{ 
                            display: 'flex', 
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            marginBottom: '12px'
                        }}
                    >
                        <div 
                            style={{
                                padding: '8px 12px',
                                borderRadius: '12px',
                                maxWidth: '80%',
                                background: msg.role === 'user' ? '#007B7B' : '#fff',
                                color: msg.role === 'user' ? '#fff' : '#333',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                                {msg.content}
                            </pre>
                            {index > 0 && msg.role === 'assistant' && !msg.content.startsWith('[ERROR]') && (
                                <Button 
                                    type="link" 
                                    size="small"
                                    style={{ display: 'block', padding: '4px 0 0 0', color: msg.role === 'user' ? '#e6f7ff' : '#004d4d' }}
                                    onClick={() => handleSaveSuggestion(msg.content)}
                                >
                                    Use this suggestion
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', paddingLeft: '12px' }}>
                        <Spin indicator={<ThunderboltOutlined spin />} style={{ marginRight: 12, color: '#007B7B' }} />
                        Analyzing resume data...
                    </div>
                )}
            </div>

            <Space.Compact style={{ width: '100%' }}>
                <Input
                    size="large"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask AI to write a summary or check your skills..."
                    disabled={loading}
                />
                <Button type="primary" icon={<SendOutlined />} size="large" onClick={handleSend} loading={loading} />
            </Space.Compact>
        </Modal>
    );
};

export default ChatModal;