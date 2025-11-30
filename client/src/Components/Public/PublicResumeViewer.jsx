import React, { useEffect, useState } from 'react';
import { Spin, Alert, Button } from 'antd';
import { API_BASE_URL } from "../../Config/constraints"; // Ensure this points to the correct config
import ResumeDesigns from "../ResumePreview/ResumeDesigns";

const PublicResumeViewer = () => {
    // 1. Get the ID from the URL manually since we use a custom router
    const path = window.location.pathname;
    const resumeId = path.split('/').pop(); // Gets the last part: /view/123 -> 123

    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPublicResume = async () => {
            try {
                // 2. Use the PUBLIC endpoint (no token required)
                // Make sure your backend has the /api/public route set up!
                const response = await fetch(`${API_BASE_URL}/public/${resumeId}`);
                const data = await response.json();
                
                if (data.success) {
                    setResume(data.data);
                } else {
                    setError(data.error || 'Resume not found or private.');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load resume. Server might be down.');
            } finally {
                setLoading(false);
            }
        };

        if (resumeId) {
            fetchPublicResume();
        }
    }, [resumeId]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" tip="Loading Public Resume..." />
            </div>
        );
    }
    
    if (error) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <Alert message="Access Denied" description={error} type="error" showIcon />
                <Button type="primary" href="/">Go to Home</Button>
            </div>
        );
    }

    return (
        <div style={{ background: '#525659', minHeight: '100vh', padding: '40px 0', overflowY: 'auto' }}>
            
            {/* Top Bar CTA */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
               <Button type="primary" href="/" style={{ borderRadius: '20px' }}>
                   Built with ResumeX - Create Yours Free
               </Button>
            </div>

            {/* Resume Display (Read-Only) */}
            <ResumeDesigns 
                data={resume} 
                selectedDesign={resume.template || 'Classic'} 
                onEditSection={() => {}} // Pass empty function so clicking does nothing
            />

            {/* CSS to forcefully hide any "Edit" buttons that might slip through */}
            <style>{`
                .print\\:hidden, .ant-btn-icon-only { display: none !important; }
            `}</style>
        </div>
    );
};

export default PublicResumeViewer;