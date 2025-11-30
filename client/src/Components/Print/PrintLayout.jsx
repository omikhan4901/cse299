import React, { useEffect, useState } from 'react';
import { useRouter } from "../../Context/context-definitions";
import ResumeDesigns from "../ResumePreview/ResumeDesigns";
import { initialResumeState } from "../../Config/constraints";

const PrintLayout = () => {
    const { navigate } = useRouter();
    // Default to initial state, but ready to receive real data
    const [data, setData] = useState(initialResumeState);
    const [design, setDesign] = useState('Classic');

    useEffect(() => {
        // 1. Retrieve data from LocalStorage
        const storedData = localStorage.getItem('printData');
        const storedDesign = localStorage.getItem('printDesign');

        if (storedData) setData(JSON.parse(storedData));
        if (storedDesign) setDesign(storedDesign);

        // 2. Trigger print dialog after a brief render delay
        const printTimer = setTimeout(() => {
            window.print();
        }, 500);

       const handleAfterPrint = () => {
            // --- FIX 1: CLEAR DESIGN STATE ---
            localStorage.removeItem('printData');
            localStorage.removeItem('printDesign');
            // ---------------------------------
            navigate('/builder');
        };

        window.addEventListener("afterprint", handleAfterPrint);
        // We use window.onafterprint as the primary driver for navigation,
        // but let's ensure we clean up the previous listener
        const mediaQueryList = window.matchMedia('print');
        const handlePrintEnd = (mql) => {
            if (!mql.matches) {
                // If the dialog closes *without* printing (like clicking cancel)
                localStorage.removeItem('printData');
                localStorage.removeItem('printDesign');
                navigate('/builder');
            }
        };
        mediaQueryList.addListener(handlePrintEnd);


        return () => {
            clearTimeout(printTimer);
            window.removeEventListener("afterprint", handleAfterPrint);
            mediaQueryList.removeListener(handlePrintEnd);
        };
    }, [navigate]);
    
    return (
        // A clean container with no extra styling that might interfere
        <div style={{ width: '100%', margin: 0, padding: 0 }}>
            <ResumeDesigns data={data} selectedDesign={design} />
        </div>
    );
};

export default PrintLayout;