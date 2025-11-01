import React, { useState, useEffect } from 'react';
import { useAuth, useRouter } from "../../Context/context";
import { Input, Button, Card, Icons } from "../random";
// UPDATED: Use ResumeDesigns wrapper and import available options
import ResumeDesigns,  {designOptions } from "../ResumePreview/ResumeDesigns";
import ChatModal from "../AiChat/AiChat";
import { initialResumeState, API_BASE_URL } from "../../Config/constraints";

// --- Sub-Component: Dynamic List Editor ---

const DynamicListEditor = ({ title, sectionName, items, onAdd, onUpdate, onDelete, onRefine, refiningId }) => {
    return (
        <Card className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex justify-between items-center">
                {title}
                <Button variant="secondary" onClick={onAdd} className="ml-4">
                    <Icons.Plus className="w-4 h-4 mr-2" /> Add Entry
                </Button>
            </h3>
            <div className="space-y-4">
                {items.map((item) => (
                    <div key={item.id} className="p-4 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-indigo-50 dark:bg-gray-700 shadow-sm relative">
                        {/* Action Buttons */}
                        <div className="absolute top-2 right-2 flex space-x-2">
                            {sectionName === 'experience' && (
                                <Button
                                    variant="ai"
                                    onClick={() => onRefine(item.id, item.description)}
                                    loading={refiningId === item.id}
                                    disabled={refiningId && refiningId !== item.id}
                                    className="p-1 h-8 w-8 text-xs"
                                >
                                    <Icons.Zap className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="danger"
                                onClick={() => onDelete(item.id)}
                                className="p-1 h-8 w-8 text-xs"
                                disabled={refiningId}
                            >
                                <Icons.X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Form Fields */}
                        {sectionName === 'experience' ? (
                            <>
                                <Input label="Title" name="title" value={item.title} onChange={(e) => onUpdate(item.id, 'title', e.target.value)} />
                                <Input label="Company" name="company" value={item.company} onChange={(e) => onUpdate(item.id, 'company', e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Start Date (YYYY-MM)" name="startDate" value={item.startDate} onChange={(e) => onUpdate(item.id, 'startDate', e.target.value)} />
                                    <Input label="End Date (YYYY-MM/Present)" name="endDate" value={item.endDate} onChange={(e) => onUpdate(item.id, 'endDate', e.target.value)} />
                                </div>
                                <Input type="textarea" label="Description (Bullet Points)" name="description" value={item.description} onChange={(e) => onUpdate(item.id, 'description', e.target.value)} />
                            </>
                        ) : (
                            <>
                                <Input label="Institution" name="institution" value={item.institution} onChange={(e) => onUpdate(item.id, 'institution', e.target.value)} />
                                <Input label="Degree / Field of Study" name="degree" value={item.degree} onChange={(e) => onUpdate(item.id, 'degree', e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Start Year" name="startYear" value={item.startYear} onChange={(e) => onUpdate(item.id, 'startYear', e.target.value)} />
                                    <Input label="End Year" name="endYear" value={item.endDate} onChange={(e) => onUpdate(item.id, 'endYear', e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};

// --- Main Resume Builder Component (Protected) ---

const ResumeBuilder = () => {
    const { user, loading: authLoading, token } = useAuth();
    const { navigate } = useRouter();
    const [resume, setResume] = useState(initialResumeState);
    const [refiningId, setRefiningId] = useState(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    // NEW: State to track the selected resume design
    const [selectedDesign, setSelectedDesign] = useState('Classic'); 

    // Redirect unauthenticated users
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [authLoading, user, navigate]);

    // --- Data Handlers ---

    const handleFieldChange = (section, field, value) => {
        setResume(p => ({ ...p, [section]: { ...p[section], [field]: value } }));
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

    // --- AI Integration Handlers ---

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
                // IMPORTANT: Replaced alert() with a console error or custom modal if available
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
        formData.append('resumeFile', file); // 'resumeFile' must match the Multer field name

        try {
            const response = await fetch(`${API_BASE_URL}/ai/parse`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const data = await response.json();

            if (data.success && data.extractedData) {
                const extracted = data.extractedData;
                
                // Map the extracted data to the local state structure, adding unique IDs
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
                // IMPORTANT: Replaced alert() with a console log/temporary message
                console.log('Resume successfully parsed and form is filled!');
            } else {
                setUploadError(`Parsing failed: ${data.error || 'Could not extract valid data. Try a simpler file format.'}`);
            }
        } catch (error) {
            setUploadError('Network error during file parsing. Check server logs.');
            console.error('Parsing error:', error);
        } finally {
            setUploadLoading(false);
            e.target.value = null; // Reset file input
        }
    };
    
    const handleDownloadPDF = () => { window.print(); };

    if (authLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center text-xl text-indigo-600 dark:text-indigo-400">Loading...</div>;
    }

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
                        
                        {/* File Upload / AI Parse Card */}
                        <Card className="flex flex-col md:flex-row justify-between items-center mb-6 p-4 bg-indigo-50 dark:bg-gray-700 border-indigo-300">
                             <div className="text-lg font-semibold text-indigo-800 dark:text-indigo-300 mb-2 md:mb-0">
                                Start with an existing resume (PDF/DOCX):
                            </div>
                            <div className="relative">
                                <Button
                                    variant="secondary"
                                    loading={uploadLoading}
                                    className="w-full md:w-auto"
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
                        
                        {/* NEW: Design Selector */}
                        <Card className="mb-6">
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.Layout className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> Choose Design</h2>
                            <label htmlFor="design-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select Template:
                            </label>
                            {/* We use a native select here for simplicity */}
                            <select
                                id="design-selector"
                                value={selectedDesign}
                                onChange={(e) => setSelectedDesign(e.target.value)}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                {designOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Card>


                        {/* 1. Personal Information */}
                        <Card>
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.User className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> Personal Information</h2>
                            <Input label="Full Name" value={resume.personal.name} onChange={(e) => handleFieldChange('personal', 'name', e.target.value)} />
                            <Input label="Professional Title" value={resume.personal.title} onChange={(e) => handleFieldChange('personal', 'title', e.target.value)} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Email" type="email" value={resume.personal.email} onChange={(e) => handleFieldChange('personal', 'email', e.target.value)} />
                                <Input label="Phone" value={resume.personal.phone} onChange={(e) => handleFieldChange('personal', 'phone', e.target.value)} />
                            </div>
                            <Input label="LinkedIn/Portfolio URL" value={resume.personal.linkedin} onChange={(e) => handleFieldChange('personal', 'linkedin', e.target.value)} />
                            <Input label="City, State" value={resume.personal.city} onChange={(e) => handleFieldChange('personal', 'city', e.target.value)} />
                        </Card>

                        {/* 2. Professional Summary */}
                        <Card>
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.FileText className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> Professional Summary</h2>
                            <Input type="textarea" label="A brief, powerful summary (3-5 sentences)" rows={5} value={resume.summary} onChange={(e) => handleFieldChange('summary', 'summary', e.target.value)} />
                            <Button variant="ai" onClick={() => setChatOpen(true)} className="w-full mt-2">
                                <Icons.Zap className="w-4 h-4 mr-2" /> Refine with AI Chat
                            </Button>
                        </Card>

                        {/* 3. Experience */}
                        <DynamicListEditor
                            title="Work Experience"
                            sectionName="experience"
                            items={resume.experience}
                            onAdd={() => handleAddItem('experience')}
                            onUpdate={(id, k, v) => handleListUpdate('experience', id, k, v)}
                            onDelete={(id) => handleDeleteItem('experience', id)}
                            onRefine={handleRefineExperience}
                            refiningId={refiningId}
                        />

                        {/* 4. Education */}
                        <DynamicListEditor
                            title="Education"
                            sectionName="education"
                            items={resume.education}
                            onAdd={() => handleAddItem('education')}
                            onUpdate={(id, k, v) => handleListUpdate('education', id, k, v)}
                            onDelete={(id) => handleDeleteItem('education', id)}
                            onRefine={() => {}} // Education doesn't have the refinement button
                            refiningId={null}
                        />

                        {/* 5. Skills */}
                        <Card>
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700"><Icons.Zap className="w-6 h-6 mr-3 text-indigo-600 dark:text-indigo-400" /> Skills</h2>
                            <Input type="textarea" label="Technical and Soft Skills (Comma separated)" value={resume.skills} onChange={(e) => handleFieldChange('skills', 'skills', e.target.value)} rows={3} placeholder="e.g., JavaScript, React, Node.js" />
                        </Card>

                        <div className="h-20" /> {/* Spacer for scrolling */}
                    </div>

                    {/* Right Side: Live Preview (Sticky/Fixed) */}
                    <div className="lg:w-1/2 lg:sticky lg:top-4 lg:h-screen lg:overflow-y-auto print:static print:h-auto">
                        <ResumeDesigns data={resume} selectedDesign={selectedDesign} />
                        
                        {/* Download Button */}
                        <div className="mt-8 mb-20 print:hidden">
                            <Button
                                onClick={handleDownloadPDF}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-full py-3"
                            >
                                <Icons.Download className="w-5 h-5 mr-2" /> Download PDF (Print)
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResumeBuilder;
