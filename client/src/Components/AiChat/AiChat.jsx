import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../Context/context-definitions";
import { Modal, Input, Button, Space, Spin, Typography } from 'antd';
import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { API_BASE_URL } from "../../Config/constraints";

const { Paragraph } = Typography;

const ChatModal = ({ resumeText, onSave, onClose, open }) => {
    const { token } = useAuth();
    const [conversation, setConversation] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatRef = useRef(null);

    // Reset conversation when modal opens
    useEffect(() => {
        if (open) {
            setConversation([{ 
                role: 'assistant', 
                content: "Hello! I'm your AI assistant. Your current summary is loaded. How can I help you improve it?" 
            }]);
            setInput('');
        }
    }, [open]);

    const handleSend = async () => {
        if (!input.trim() || loading || !token) return;

        const newUserMessage = { role: 'user', content: input.trim() };
        setConversation(prev => [...prev, newUserMessage]);
        setInput('');
        setLoading(true);

        const payload = {
            conversation: [...conversation, newUserMessage], 
            resumeText: resumeText,
        };

        try {
            const response = await fetch(`${API_BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (data.success && data.response) {
                const aiResponse = data.response;
                setConversation(prev => [...prev, { role: 'assistant', content: aiResponse }]);
            } else {
                throw new Error(data.error || 'Failed to get AI response.');
            }
        } catch (error) {
            console.error('Chat API error:', error);
            setConversation(prev => [...prev, { role: 'assistant', content: `[ERROR] ${error.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [conversation]);

    const handleSaveSuggestion = (text) => {
        const match = text.match(/([A-Z][\s\S]*)/);
        const suggestion = match ? match[1].trim() : text.trim();
        
        Modal.confirm({
            title: 'Save AI Suggestion?',
            content: (
                <Paragraph ellipsis={{ rows: 5, expandable: true }}>
                    {suggestion}
                </Paragraph>
            ),
            okText: "Save to Summary",
            onOk: () => onSave(suggestion),
        });
    };

    return (
        <Modal
            title="AI Conversational Editor (Summary)"
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
                            <pre style={{ 
                                whiteSpace: 'pre-wrap', 
                                wordWrap: 'break-word', 
                                margin: 0, 
                                fontFamily: 'inherit' 
                            }}>
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
                        AI is thinking...
                    </div>
                )}
            </div>

            <Space.Compact style={{ width: '100%' }}>
                <Input
                    size="large"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="e.g., Make my summary more focused on data science."
                    disabled={loading}
                />
                <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    size="large"
                    onClick={handleSend} 
                    loading={loading}
                />
            </Space.Compact>
        </Modal>
    );
};

export default ChatModal;