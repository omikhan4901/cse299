import React, { useState, useEffect } from 'react';
import { useAuth, useRouter } from "../../Context/context";
import { Input, Button, Card, Icons } from "../random";
import ResumeDesigns, { designOptions } from "../ResumePreview/ResumeDesigns";
import ChatModal from "../AiChat/AiChat";
import { initialResumeState, API_BASE_URL } from "../../Config/constraints";
// NEW: Import the extracted component
import DynamicListEditor from './DynamicListEditor';

// --- Main Resume Builder Component (Refactored) ---

const ResumeBuilder = () => {
    const { user, loading: authLoading, token } = useAuth();
    const { navigate } = useRouter();
    
    // --- State ---
    const [resume, setResume] = useState(initialResumeState);
    const [refiningId, setRefiningId] = useState(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [selectedDesign, setSelectedDesign] = useState('Classic');
    // NEW: State to manage the active form tab
    const [activeTab, setActiveTab] = useState('personal');

    // --- Effects ---
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [authLoading, user, navigate]);

    // --- Data Handlers (Unchanged) ---
    // These functions are stable and handle all state mutations.
    // (handleFieldChange, handleListUpdate, handleAddItem, handleDeleteItem)

    const handleFieldChange = (section, field, value) => {
        if (section === 'summary' || section === 'skills') {
            setResume(p => ({ ...p, [section]: value }));
        } else {
            setResume(p => ({ ...p, [section]: { ...p[section], [field]: value } }));
        }
    };

    const handleListUpdate = (section, id, field, value) => {
        setResume(prev => ({
            ...prev,
            [section]: prev[section].map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const handleAddItem = (section) => {
        const newEntry = section === 'experience'
            ? { id: Date.now(), company: '', title: '', startDate: '', endDate: '', description: '' }
            : { id: Date.now(), institution: '', degree: '', startYear: '', endYear: '' };

        setResume(prev => ({ ...prev, [section]: [...prev[section], newEntry] }));
    };

    const handleDeleteItem = (section, id) => {
        setResume(prev => ({ ...prev, [section]: prev[section].filter(item => item.id !== id) }));
    };

    // --- AI Handlers (Unchanged) ---
    // These API call wrappers are stable.
    // (handleRefineExperience, handleChatSave, handleParseResume)

    const handleRefineExperience = async (itemId, originalText) => {
        if (!token) return navigate('/login');
        setRefiningId(itemId);

        try {
            const response = await fetch(`${API_BASE_URL}/ai/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ resumeText: originalText }),
            });
            const data = await response.json();

            if (data.success && data.refinedText) {
                handleListUpdate('experience', itemId, 'description', data.refinedText);
            } else {
                console.error(`Refinement failed: ${data.error || 'Unknown error.'}`);
            }
        } catch (error) {
            console.error('Network error during refinement:', error);
        } finally {
            setRefiningId(null);
        }
    };

    const handleChatSave = (newText) => {
        setResume(prev => ({ ...prev, summary: newText }));
        setChatOpen(false);
    };

    const handleParseResume = async (e) => {
        if (!token) return navigate('/login');
        setUploadError(null);
        const file = e.target.files[0];
        if (!file) return;

        setUploadLoading(true);

        const formData = new FormData();
        formData.append('resumeFile', file); 

        try {
            const response = await fetch(`${API_BASE_URL}/ai/parse`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const data = await response.json();

            if (data.success && data.extractedData) {
                const extracted = data.extractedData;
                const mappedData = {
                    personal: extracted.personal || initialResumeState.personal,
                    summary: extracted.summary || '',
                    experience: (extracted.experience || []).map((item, index) => ({ 
                        ...item, 
                        id: Date.now() + index,
                        description: item.description || '' 
                    })),
                    education: (extracted.education || []).map((item, index) => ({ 
                        ...item, 
                        id: Date.now() + index + 100 
                    })),
                    skills: extracted.skills || '',
                };
                setResume(mappedData);
                console.log('Resume successfully parsed and form is filled!');
            } else {
                setUploadError(`Parsing failed: ${data.error || 'Could not extract valid data.'}`);
            }
        } catch (error) {
            setUploadError('Network error during file parsing. Check server logs.');
            console.error('Parsing error:', error);
        } finally {
            setUploadLoading(false);
            e.target.value = null; 
        }
    };
    
    // --- Render Helpers ---

    const handleDownloadPDF = () => { window.print(); };

    // A simple component for the new tab buttons
    const TabButton = ({ tabId, label, icon: Icon }) => (
        <Button
            variant={activeTab === tabId ? 'primary' : 'secondary'}
            onClick={() => setActiveTab(tabId)}
            className="flex-1"
        >
            <Icon className="w-4 h-4 mr-2" />
            {label}
        </Button>
    );

    // Loading state
    if (authLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center text-xl text-indigo-600 dark:text-indigo-400">Loading...</div>;
    }

    // --- Main Render ---
    return (
        <div className="min-h-screen font-sans bg-gray-100 dark:bg-gray-900 transition-colors duration-500 p-4 pt-16 print:p-0">
            {chatOpen && <ChatModal resumeText={resume.summary} onSave={handleChatSave} onClose={() => setChatOpen(false)} />}
            
            <div className="max-w-7xl mx-auto py-6">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-8 text-center print:hidden">
                    AI Resume Editor
                </h1>

                <div className="flex flex-col lg:flex-row gap-8 print:block">
                    {/* Left Side: Input Form (Scrollable) */}
                    <div className="lg:w-1/2 space-y-6 lg:h-screen lg:overflow-y-scroll lg:pr-4 print:hidden">
                        
                        {/* --- Panel 1: AI Parsing --- */}
                        <Card className="bg-indigo-50 dark:bg-gray-700 border-indigo-300">
                             <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.Upload className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> AI Resume Parser</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Start by uploading an existing resume (PDF/DOCX).</p>
                            <div className="relative">
                                <Button
                                    variant="secondary"
                                    loading={uploadLoading}
                                    className="w-full"
                                >
                                    <Icons.Upload className="w-4 h-4 mr-2" /> 
                                    {uploadLoading ? 'Parsing...' : 'Upload File'}
                                </Button>
                                <input
                                    type="file"
                                    name="resumeFile"
                                    accept=".pdf,.docx"
                                    onChange={handleParseResume}
                                    disabled={uploadLoading}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                            </div>
                            {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
                        </Card>
                        
                        {/* --- Panel 2: Settings & Actions --- */}
                        <Card>
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.Layout className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> Settings & Actions</h2>
                            {/* Design Selector */}
                            <label htmlFor="design-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                1. Select Template
                            </label>
                            <select
                                id="design-selector"
                                value={selectedDesign}
                                onChange={(e) => setSelectedDesign(e.target.value)}
                                className="mb-4 mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                {designOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            
                            {/* Download Button */}
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                2. Download
                            </label>
                            <Button
                                onClick={handleDownloadPDF}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-full py-3 mt-1"
                            >
                                <Icons.Download className="w-5 h-5 mr-2" /> Download PDF (Print)
                            </Button>
                        </Card>

                        {/* --- Panel 3: Resume Editor Tabs --- */}
                        <Card>
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.FileText className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> Resume Editor</h2>
                            
                            {/* Tab Navigation */}
                            {/* FIX: 
                                - Replaced 'flex' with 'flex flex-wrap' to allow buttons to wrap to the next line.
                                - Replaced 'space-x-2' with 'gap-2' for better spacing when wrapped.
                            */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                <TabButton tabId="personal" label="Personal" icon={Icons.User} />
                                <TabButton tabId="summary" label="Summary" icon={Icons.FileText} />
                                <TabButton tabId="experience" label="Experience" icon={Icons.Zap} />
                                <TabButton tabId="education" label="Education" icon={Icons.Home} /> 
                                <TabButton tabId="skills" label="Skills" icon={Icons.Zap} />
                            </div>

                            {/* Tab Content */}
                            <div className="tab-content">
                                {activeTab === 'personal' && (
                                    <section>
                                        <Input label="Full Name" value={resume.personal.name} onChange={(e) => handleFieldChange('personal', 'name', e.target.value)} />
                                        <Input label="Professional Title" value={resume.personal.title} onChange={(e) => handleFieldChange('personal', 'title', e.target.value)} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input label="Email" type="email" value={resume.personal.email} onChange={(e) => handleFieldChange('personal', 'email', e.target.value)} />
                                            <Input label="Phone" value={resume.personal.phone} onChange={(e) => handleFieldChange('personal', 'phone', e.target.value)} />
                                        </div>
                                        <Input label="LinkedIn/Portfolio URL" value={resume.personal.linkedin} onChange={(e) => handleFieldChange('personal', 'linkedin', e.target.value)} />
                                        <Input label="City, State" value={resume.personal.city} onChange={(e) => handleFieldChange('personal', 'city', e.target.value)} />
                                    </section>
                                )}

                                {activeTab === 'summary' && (
                                    <section>
                                        <Input type="textarea" label="A brief, powerful summary (3-5 sentences)" rows={5} value={resume.summary} onChange={(e) => handleFieldChange('summary', null, e.target.value)} />
                                        <Button variant="ai" onClick={() => setChatOpen(true)} className="w-full mt-2">
                                            <Icons.Zap className="w-4 h-4 mr-2" /> Refine with AI Chat
                                        </Button>
                                    </section>
                                )}

                                {activeTab === 'experience' && (
                                    <DynamicListEditor
                                        title="Work Experience"
                                        sectionName="experience"
                                        items={resume.experience}
                                        onAdd={() => handleAddItem('experience')}
                                        onUpdate={handleListUpdate}
                                        onDelete={(id) => handleDeleteItem('experience', id)}
                                        onRefine={handleRefineExperience}
                                        refiningId={refiningId}
                                    />
                                )}

                                {activeTab === 'education' && (
                                    <DynamicListEditor
                                        title="Education"
                                        sectionName="education"
                                        items={resume.education}
                                        onAdd={() => handleAddItem('education')}
                                        onUpdate={handleListUpdate}
                                        onDelete={(id) => handleDeleteItem('education', id)}
                                        onRefine={null} // No AI refine for education
                                        refiningId={null}
                                    />
                                )}

                                {activeTab === 'skills' && (
                                    <section>
                                        <Input type="textarea" label="Technical and Soft Skills (Comma separated)" value={resume.skills} onChange={(e) => handleFieldChange('skills', null, e.target.value)} rows={3} placeholder="e.g., JavaScript, React, Node.js" />
                                    </section>
                                )}
                            </div>
                        </Card>

                        <div className="h-20" /> {/* Spacer for scrolling */}
                    </div>

                    {/* Right Side: Live Preview (Sticky/Fixed) */}
                    <div className="lg:w-1/2 lg:sticky lg:top-4 lg:h-screen lg:overflow-y-auto print:static print:h-auto">
                        <ResumeDesigns data={resume} selectedDesign={selectedDesign} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResumeBuilder;


