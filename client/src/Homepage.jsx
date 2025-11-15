import React from 'react';
import { useAuth, useRouter } from './Context/context-definitions';
import { Row, Col, Button, Typography } from 'antd';
import ResumeIllustration from './ResumeIllustration';
// 1. Import 'motion' from Framer Motion
import { motion } from 'framer-motion';

const { Title, Paragraph } = Typography;

// 2. Define the animation variants for the text hover
const textHoverVariant = {
  hover: {
    y: -5,
    scale: 1.1,
    transition: { type: 'spring', stiffness: 300 }
  }
};

// 3. Define the animation variants for the button hover
const buttonHoverVariant = {
  hover: {
    y: -5,
    scale: 1.05,
    boxShadow: "0 10px 20px rgba(0, 123, 123, 0.2)",
    transition: { type: 'spring', stiffness: 300 }
  }
};

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const { navigate } = useRouter();

  const handleGetStarted = () => {
    if (isAuthenticated) navigate('/builder');
    else navigate('/register');
  };

  return (
    // FIX: Changed styles to use flexbox for perfect vertical centering
    <div style={{
      backgroundColor: '#f0f9f9',
      minHeight: 'calc(93vh)', // Assumes 64px navbar height
      padding: '40px 80px',
      overflow: 'hidden',
      display: 'flex', // Use flex
      alignItems: 'center', // Vertically center the Row
      width: '100%'
    }}>
      <Row 
        align="middle"
        style={{ width: '100%' }} // Make Row take full width
      >
        {/* Left Column: Text Content */}
        <Col xs={24} lg={11} style={{ paddingRight: '40px' }}>
          <Title level={1} style={{
            fontSize: '54px',
            fontWeight: 700,
            lineHeight: '1.2',
            marginBottom: '24px',
            color: '#002A3A'
          }}>
            Unlock the{' '}
            {/* 4. Wrap "Resume" in motion.span */}
            <motion.span
              style={{ color: '#007B7B', display: 'inline-block', cursor: 'pointer' }}
              variants={textHoverVariant}
              whileHover="hover"
            >
              Resume
            </motion.span>
            {' '}That{' '}
            {/* 5. Wrap "lands the job" in motion.span */}
            <motion.span
              style={{ color: '#007B7B', display: 'inline-block', cursor: 'pointer' }}
              variants={textHoverVariant}
              whileHover="hover"
            >
              lands the job
            </motion.span>
          </Title>
          <Paragraph style={{ fontSize: '18px', color: '#555', margin: '20px 0 30px' }}>
            With our State of the art AI-driven resume maker, you will finally unlock the full of your resume.
          </Paragraph>
          
          {/* 6. Wrap the Button in motion.div */}
          <motion.div
            style={{ display: 'inline-block' }} // Wrapper for the button
            variants={buttonHoverVariant}
            whileHover="hover"
          >
            <Button 
              type="primary"
              size="large" 
              style={{ height: '50px', fontSize: '18px', padding: '0 32px' }}
              onClick={handleGetStarted}
            >
              {isAuthenticated ? 'Go to Builder' : 'Get Started'}
            </Button>
          </motion.div>
        </Col>
        
        {/* Right Column: Illustration */}
        <Col xs={24} lg={13}>
          <ResumeIllustration />
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;