import React from 'react';
import heroSvgUrl from './hero.svg';
// 1. Import 'motion' from Framer Motion
import { motion } from 'framer-motion';

const ResumeIllustration = () => {
  return (
    // 2. Change <img> to <motion.img>
    <motion.img 
      src={heroSvgUrl} 
      alt="AI Resume Builder Illustration"
      style={{
        marginTop: "100px",
        width: '100%',
        maxWidth: '550px',
        height: 'auto',
        margin: 'auto',
        display: 'block',
        cursor: 'pointer',
      }}
      
      // --- Smooth Float Animation ---
      animate={{
        y: -10 // Animate TO this "up" position
      }}
      // --- End of Float Animation ---

      // --- Hover Animation (Restored) ---
      whileHover={{
        scale: 1.05, // Scale up slightly
        y: -15, // Lift a bit higher than the float
        transition: { type: 'spring', stiffness: 300 } // Bouncy effect
      }}
      // --- End of Hover Animation ---
    />
  );
};

export default ResumeIllustration;