import React, { useEffect, useState, useRef } from 'react'; 
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

const ResumeDesigns = ({ data, selectedDesign, onEditSection, showPageBreaks, editingSection }) => {
    const resumeRef = useRef(null);
    const [contentHeight, setContentHeight] = useState(0);
    
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

    // Dynamic height calculation for page break indicators
    // Measures content wrapper to avoid circular dependency with absolute-positioned markers
    const contentRef = useRef(null);

    useEffect(() => {
        if (!contentRef.current) return;

        const observer = new ResizeObserver(() => {
            if (contentRef.current) {
                // We use scrollHeight of the inner content wrapper
                setContentHeight(contentRef.current.scrollHeight);
            }
        });

        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, []);

    const ResumeComponent = designComponents[selectedDesign] || ClassicDesign;
    const isDark = selectedDesign.includes('Dark'); 
    
    const isFullBleed = selectedDesign.includes('Modern') || 
                        selectedDesign.includes('Creative') || 
                        selectedDesign === 'CoolBlue' ||
                        selectedDesign === 'BasicStylish' ||
                        selectedDesign === 'MinimalistBeige' ||
                        selectedDesign === 'ModernGothic';  

    const printPaddingClass = isFullBleed ? 'print:p-0' : 'print:p-12';
    
    // A4 Height @ 96 DPI ~= 1123px
    const PAGE_HEIGHT_PX = 1123; 

    return (
        <div 
            id="resume-document"
            ref={resumeRef} 
            className={`relative group p-8 shadow-xl min-h-[11in] w-full max-w-[8.5in] mx-auto 
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
            {/* --- PAGE BREAK INDICATORS --- */}
            {showPageBreaks && [1, 2, 3].map(page => {
                // Only show markers if the content actually reaches this page
                // We show marker N if contentHeight > (N-1) * PAGE_HEIGHT
                // e.g. Page 1 marker (at bottom of p1) should show if we have content on P1 (always true basically if min-h is there)
                // But actually, "End of Page 1" marker is at 1123px.
                // We want to see it if our content *approaches* it or crosses it.
                // If content is very short (500px), do we want to see the marker at 1123px?
                // Yes, so we know how much space is left.
                // But we definitely don't want to see Page 2 marker (2246px) if content is 500px.
                // Rule: Show marker N if contentHeight > (N-1) * PAGE_HEIGHT_PX
                
                if (contentHeight <= (page - 1) * PAGE_HEIGHT_PX) return null;

                return (
                    <div 
                        key={page}
                        style={{ 
                            position: 'absolute', 
                            top: `${page * PAGE_HEIGHT_PX}px`, 
                            left: 0, 
                            width: '100%', 
                            height: '2px',
                            borderBottom: '2px dashed #ff4d4f',
                            zIndex: 50,
                            pointerEvents: 'none'
                        }}
                    >
                         <span style={{ 
                             position: 'absolute', 
                             right: 0, 
                             top: '-20px', 
                             background: '#ff4d4f', 
                             color: 'white', 
                             fontSize: '12px', 
                             padding: '2px 8px',
                             borderRadius: '4px 0 0 4px'
                         }}>
                            End of Page {page}
                         </span>
                    </div>
                );
            })}

            {/* Content Wrapper for Measurement */}
            <div ref={contentRef} className="h-full">
                <ResumeComponent data={data} onEditSection={onEditSection} editingSection={editingSection} />
                
                <footer className="mt-8 text-xs text-gray-400 dark:text-gray-600 text-center border-t pt-2 print:hidden">
                    Version {RESUME_VERSION}
                </footer>
            </div>
        </div>
    );
};

export default ResumeDesigns;