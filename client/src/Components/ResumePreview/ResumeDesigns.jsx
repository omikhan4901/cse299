import React, { useEffect } from 'react'; 
import ClassicDesign from './ClassicDesign'; 
import ModernDesign from './ModernDesign'; 
import ClassicDarkDesign from './ClassicDarkDesign'; 
import ModernDarkDesign from './ModernDarkDesign'; 

const RESUME_VERSION = '1.0'; 

const designComponents = {
    Classic: ClassicDesign,
    Modern: ModernDesign,
    ClassicDark: ClassicDarkDesign,
    ModernDark: ModernDarkDesign,
};

export const designOptions = [
    { value: 'Classic', label: 'Classic (Traditional)' },
    { value: 'ClassicDark', label: 'Classic (Dark Mode)' },
    { value: 'Modern', label: 'Modern (Clean Lines)' },
    { value: 'ModernDark', label: 'Modern (Dark Mode)' },
];

const ResumeDesigns = ({ data, selectedDesign, onEditSection }) => {
    
    // This effect handles the dark mode printing logic
    useEffect(() => {
        const styleId = 'print-background-fix';
        let styleTag = document.getElementById(styleId);
        const isDark = selectedDesign.includes('Dark');

        if (isDark) {
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = styleId;
                document.head.appendChild(styleTag);
            }
            styleTag.textContent = `
                @media print {
                    @page {
                        margin: 0;
                        size: A4; 
                    }
                    html, body { 
                        background-color: #111827 !important; 
                        color: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 100%;
                        width: 100%;
                    }
                    #root {
                        height: 100%;
                    }
                    #resume-document {
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        height: 100%;
                        min-height: 0;
                        width: 100%;
                    }
                    #resume-document, #resume-document *, 
                    #resume-document h1, #resume-document h2, #resume-document h3 {
                        color: #ffffff !important;
                    }
                }
            `;
        } else {
            if (styleTag) {
                styleTag.remove();
            }
        }
    }, [selectedDesign]);

    const ResumeComponent = designComponents[selectedDesign] || ClassicDesign;
    const isDark = selectedDesign.includes('Dark');

    return (
        <div 
            id="resume-document" 
            // ADD 'group' CLASS TO ENABLE HOVER-CHILDREN
            className={`group p-8 shadow-xl min-h-[11in] w-full max-w-[8.5in] mx-auto print:shadow-none print:p-0 print:m-0 transition-shadow duration-300 hover:shadow-2xl 
                ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`
            }
        >
            {/* PASS THE 'onEditSection' PROP DOWN */}
            <ResumeComponent data={data} onEditSection={onEditSection} />
            
            <footer className="mt-8 text-xs text-gray-400 dark:text-gray-600 text-center border-t pt-2 print:hidden">
                Version {RESUME_VERSION} - Powered by Gemini AI
            </footer>
        </div>
    );
};

export default ResumeDesigns;