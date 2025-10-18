import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../Context/context";
import { Input, Button, Card, Icons } from "../random";
import { API_BASE_URL } from "../../Config/constraints";

const ChatModal = ({ resumeText, onSave, onClose }) => {
    const { token } = useAuth();
    const [conversation, setConversation] = useState([{ role: 'assistant', content: "Hello! I am your AI Resume Assistant. Tell me what you want to improve about your current summary, or ask me to write a new one!" }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatRef = useRef(null);

    const handleSend = async () => {
        if (!input.trim() || loading || !token) return;

        const newUserMessage = { role: 'user', content: input.trim() };
        setConversation(prev => [...prev, newUserMessage]);
        setInput('');
        setLoading(true);

        // We sliceto remove the initial assistant greeting from the history sent to the server
        const payload = {
            conversation: [...conversation.slice(1), newUserMessage],
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

                // Simple check: if the response looks like text with punctuation, offer to save it
                const parts = aiResponse.split('\n\n');
                if (parts.length > 1 || parts[0].includes('.') || parts[0].includes(' ')) { 
                    if (window.confirm("AI has suggested new content. Would you like to use the first paragraph to replace your current summary?")) {
                        onSave(parts[0].trim());
                    }
                }
            } else {
                setConversation(prev => [...prev, { role: 'assistant', content: `[ERROR] ${data.error || 'Failed to get AI response.'}` }]);
            }
        } catch (error) {
            console.error('Chat API error:', error);
            setConversation(prev => [...prev, { role: 'assistant', content: '[ERROR] Network error during AI processing.' }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [conversation]);

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-[100] flex items-center justify-center p-4 print:hidden">
            <Card className="w-full max-w-2xl h-[90vh] flex flex-col dark:bg-gray-700">
                <h2 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-indigo-400 border-b pb-2 flex justify-between items-center">
                    AI Conversational Editor (Summary Focus)
                    <Button onClick={onClose} variant="danger" className="ml-4 h-8 w-8 p-0">X</Button>
                </h2>

                <div ref={chatRef} className="flex-grow overflow-y-auto p-4 space-y-4 border rounded-lg bg-gray-50 dark:bg-gray-800 mb-4">
                    {conversation.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-xl max-w-[80%] shadow-md ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-200 dark:bg-gray-600 text-gray-600 p-3 rounded-xl max-w-[80%] flex items-center">
                                <Icons.Zap className="w-4 h-4 mr-2 animate-spin text-yellow-500" />
                                AI is thinking...
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex">
                    <Input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="e.g., Make it focused on data science."
                        className="flex-grow mb-0"
                    />
                    <Button onClick={handleSend} disabled={loading} className="ml-2 px-6">
                        <Icons.Send className="w-5 h-5" />
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default ChatModal;
