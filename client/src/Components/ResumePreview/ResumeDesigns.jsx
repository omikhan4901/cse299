import React, { useEffect } from 'react'; 
import ClassicDesign from './ClassicDesign'; 
import ModernDesign from './ModernDesign'; 
import ClassicDarkDesign from './ClassicDarkDesign'; 
import ModernDarkDesign from './ModernDarkDesign'; 
import CreativeDesign from './CreativeDesign';
import CoolBlueDesign from './CoolBlueDesign';
import BasicStylishDesign from './BasicStylishDesign';
import ModernGothicDesign from './ModernGothicDesign';
import MinimalistBeigeDesign from './MinimalistBeigeDesign';
const RESUME_VERSION = '1.0'; 

const designComponents = {
    Classic: ClassicDesign,
    Modern: ModernDesign,
    ClassicDark: ClassicDarkDesign,
    ModernDark: ModernDarkDesign,
    Creative: CreativeDesign,
    CoolBlue: CoolBlueDesign,
    BasicStylish: BasicStylishDesign,
    MinimalistBeige: MinimalistBeigeDesign,
    ModernGothic: ModernGothicDesign,

};

export const designOptions = [
    { value: 'Classic', label: 'Classic (Traditional)' },
    { value: 'ClassicDark', label: 'Classic (Dark Mode)' },
    { value: 'Modern', label: 'Modern (Clean Lines)' },
    { value: 'ModernDark', label: 'Modern (Dark Mode)' },
    { value: 'Creative', label: 'Creative' },
    { value: 'CoolBlue', label: 'Cool Blue' },
    { value: 'BasicStylish', label: 'Basic Stylish (Clean)' },
    { value: 'MinimalistBeige', label: 'Minimalist (Warm Beige)' },
    { value: 'ModernGothic', label: 'Modern Gothic (Bold)' },
    
];

const ResumeDesigns = ({ data, selectedDesign, onEditSection }) => {
    
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
                    @page { margin: 0; size: A4; }
                    html, body { 
                        background-color: #111827 !important; 
                        color: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* FIX: Force white text on all children elements in print */
                    #resume-document, #resume-document * {
                        color: #ffffff !important;
                    }
                    /* Allow specific overrides like tags or accents to keep their color if needed */
                    #resume-document .ant-tag {
                        color: inherit; 
                    }
                    #resume-document {
                        box-shadow: none !important;
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
    
const isFullBleed = selectedDesign.includes('Modern') || 
                    selectedDesign.includes('Creative') || 
                    selectedDesign === 'CoolBlue' ||
                    selectedDesign === 'BasicStylish' ||
                    selectedDesign === 'MinimalistBeige' ||
                    selectedDesign === 'ModernGothic';  

    const printPaddingClass = isFullBleed ? 'print:p-0' : 'print:p-12';
    return (
        <div 
            id="resume-document" 
            className={`group p-8 shadow-xl min-h-[11in] w-full max-w-[8.5in] mx-auto 
                transition-shadow duration-300 hover:shadow-2xl 
                ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
                
                print:shadow-none 
                print:w-full 
                print:max-w-none 
                print:min-h-screen
                print:overflow-hidden

                ${printPaddingClass}
            `}
        >
            <ResumeComponent data={data} onEditSection={onEditSection} />
            
            <footer className="mt-8 text-xs text-gray-400 dark:text-gray-600 text-center border-t pt-2 print:hidden">
                Version {RESUME_VERSION} - Powered by Gemini AI
            </footer>
        </div>
    );
};

export default ResumeDesigns;