import React, { useEffect } from 'react'; 
import ClassicDesign from './ClassicDesign'; 
// FIX: Corrected import name from 'unrivalled_ModernDesign'
import ModernDesign from './ModernDesign'; 
import ClassicDarkDesign from './ClassicDarkDesign'; 
import ModernDarkDesign from './ModernDarkDesign'; 

// The RESUME_VERSION is used in the footer.
const RESUME_VERSION = '1.0'; 

// Map of available designs
const designComponents = {
    Classic: ClassicDesign,
    Modern: ModernDesign,
    ClassicDark: ClassicDarkDesign,
    ModernDark: ModernDarkDesign,
};

// Available design options for the user interface (NAMED EXPORT)
export const designOptions = [
    { value: 'Classic', label: 'Classic (Traditional)' },
    { value: 'ClassicDark', label: 'Classic (Dark Mode)' },
    { value: 'Modern', label: 'Modern (Clean Lines)' },
    { value: 'ModernDark', label: 'Modern (Dark Mode)' },
];

// The main component now accepts the design choice (DEFAULT EXPORT)
const ResumeDesigns = ({ data, selectedDesign }) => {
    
    // --- NEW useEffect for Print Styles ---
    useEffect(() => {
        const styleId = 'print-background-fix';
        let styleTag = document.getElementById(styleId);
        const isDark = selectedDesign.includes('Dark');

        if (isDark) {
            // If dark mode is selected, inject CSS to force background printing
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = styleId;
                document.head.appendChild(styleTag);
            }
            // CSS targets the entire document structure and uses !important
            styleTag.textContent = `
                @media print {
                    /* CRITICAL: Force background printing on the entire page/html body */
                    html, body, #resume-document { 
                        background-color: #111827 !important; /* Tailwind gray-900 */
                        color: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Ensure text is visible (white) */
                    #resume-document, #resume-document *, 
                    #resume-document h1, #resume-document h2, #resume-document h3 {
                        color: #ffffff !important;
                    }
                }
            `;
        } else {
            // If a light mode is selected, ensure the print style is removed
            if (styleTag) {
                styleTag.remove();
            }
        }
    }, [selectedDesign]);
    // --- END useEffect ---

    // Select the component based on the prop, defaulting to Classic
    const ResumeComponent = designComponents[selectedDesign] || ClassicDesign;

    // The main wrapper class must change based on whether a dark design is selected
    const isDark = selectedDesign.includes('Dark');

    return (
        <div 
            id="resume-document" 
            className={`p-8 shadow-xl min-h-[11in] w-full max-w-[8.5in] mx-auto print:shadow-none print:p-0 print:m-0 transition-shadow duration-300 hover:shadow-2xl 
                ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}` // Dynamic Background/Text
        }
        >
            <ResumeComponent data={data} />
            
            <footer className="mt-8 text-xs text-gray-400 dark:text-gray-600 text-center border-t pt-2 print:hidden">
                Version {RESUME_VERSION} - Powered by Gemini AI
            </footer>
        </div>
    );
};

export default ResumeDesigns;
