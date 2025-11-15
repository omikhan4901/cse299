import React from 'react';
import { Layout, Row, Col, Card, Typography, Button, Timeline, Collapse } from 'antd';
import { 
    ThunderboltOutlined, 
    UploadOutlined, 
    MessageOutlined,
    RocketOutlined,
    ExperimentOutlined,
    FlagOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useRouter } from '../../Context/context-definitions';

const { Content } = Layout;
const { Title, Paragraph } = Typography;
const { Panel } = Collapse;

// --- Animation Variants ---

// For sections to fade in as you scroll
const sectionFadeIn = {
    hidden: { opacity: 0, y: 50 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' }
    }
};

// For the feature cards
const cardHover = {
    hover: {
        y: -10,
        scale: 1.03,
        boxShadow: "0 20px 30px rgba(0, 123, 123, 0.2)",
        transition: { type: 'spring', stiffness: 300 }
    }
};

// For the final CTA button
const buttonHover = {
    hover: {
        y: -5,
        scale: 1.05,
        boxShadow: "0 10px 20px rgba(0, 123, 123, 0.2)",
        transition: { type: 'spring', stiffness: 300 }
    }
};

const AboutPage = () => {
    const { navigate } = useRouter();

    const faqItems = [
        {
            key: '1',
            label: 'What AI model does ResumeX use?',
            content: 'ResumeX is powered by Google\'s advanced Gemini family of models. This allows us to provide state-of-the-art text generation for summaries, high-accuracy resume parsing, and nuanced conversational editing.'
        },
        {
            key: '2',
            label: 'Is ResumeX free to use?',
            content: 'Yes! ResumeX is a final-year project (CSE299) and is completely free to use. Our goal is to demonstrate the power of modern AI in a practical, helpful application.'
        },
        {
            key: '3',
            label: 'Who built this project?',
            content: 'This application was designed, developed, and deployed by a dedicated student as part of their computer science curriculum, showcasing skills in full-stack development (React, Node.js) and AI integration.'
        },
        {
            key: '4',
            label: 'Is my resume data safe?',
            content: 'We take privacy seriously. Your data is secured using JWT (JSON Web Token) authentication, and all resume information is stored securely in a MongoDB database. Only you can access your saved profiles.'
        }
    ];

    return (
        <Layout.Content style={{ backgroundColor: '#fff', color: '#002A3A' }}>
            
            {/* --- 1. Hero Section --- */}
            <motion.div 
                style={{ 
                    backgroundColor: '#f0f9f9', 
                    padding: '80px 40px', 
                    textAlign: 'center' 
                }}
                initial="hidden"
                animate="visible"
                variants={sectionFadeIn}
            >
                <Title level={1} style={{ color: '#002A3A', fontWeight: 700, marginBottom: '20px' }}>
                    Our Mission: Smarter Resumes, Faster.
                </Title>
                <Paragraph style={{ fontSize: '18px', maxWidth: '800px', margin: 'auto', color: '#555' }}>
                    In today's competitive job market, a great resume is more than just a document—it's your first impression. 
                    ResumeX was built to level the playing field, using the power of Generative AI to help you build a professional, polished resume that gets noticed.
                </Paragraph>
            </motion.div>

            {/* --- 2. Features Section --- */}
            <motion.section 
                style={{ padding: '80px 40px', maxWidth: '1200px', margin: 'auto' }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={sectionFadeIn}
            >
                <Title level={2} style={{ textAlign: 'center', marginBottom: '60px' }}>
                    What Makes ResumeX Different?
                </Title>
                <Row gutter={[32, 32]} justify="center">
                    <Col xs={24} md={8}>
                        <motion.div variants={cardHover} whileHover="hover">
                            <Card title="AI Resume Parser" headStyle={{ color: '#007B7B', fontWeight: 'bold' }}>
                                <UploadOutlined style={{ fontSize: '32px', color: '#007B7B', marginBottom: '16px' }} />
                                <Paragraph>Start in seconds. Upload your existing resume (PDF/DOCX) and let our AI parse it, automatically filling in your entire profile.</Paragraph>
                            </Card>
                        </motion.div>
                    </Col>
                    <Col xs={24} md={8}>
                        <motion.div variants={cardHover} whileHover="hover">
                            <Card title="AI Content Refinement" headStyle={{ color: '#007B7B', fontWeight: 'bold' }}>
                                <ThunderboltOutlined style={{ fontSize: '32px', color: '#007B7B', marginBottom: '16px' }} />
                                <Paragraph>Stuck on wording? Select any part of your resume and let our AI refine it, improving clarity, grammar, and impact instantly.</Paragraph>
                            </Card>
                        </motion.div>
                    </Col>
                    <Col xs={24} md={8}>
                        <motion.div variants={cardHover} whileHover="hover">
                            <Card title="Conversational AI Chat" headStyle={{ color: '#007B7B', fontWeight: 'bold' }}>
                                <MessageOutlined style={{ fontSize: '32px', color: '#007B7B', marginBottom: '16px' }} />
                                <Paragraph>Talk to your resume. Open our AI chat to rewrite your summary, ask for suggestions, or tailor your profile to a specific job description.</Paragraph>
                            </Card>
                        </motion.div>
                    </Col>
                </Row>
            </motion.section>

            {/* --- 3. Project Journey Section --- */}
            <motion.section 
                style={{ padding: '80px 40px', backgroundColor: '#f0f9f9' }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={sectionFadeIn}
            >
                <Title level={2} style={{ textAlign: 'center', marginBottom: '60px' }}>
                    The Project Journey
                </Title>
                <div style={{ maxWidth: '800px', margin: 'auto' }}>
                    <Timeline mode="alternate">
                        <Timeline.Item dot={<ExperimentOutlined style={{ fontSize: '18px' }} />} color="#007B7B">
                            <Title level={4}>The Problem</Title>
                            <Paragraph>Traditional resume building is slow, tedious, and it's hard to know if you're "doing it right."</Paragraph>
                        </Timeline.Item>
                        <Timeline.Item dot={<RocketOutlined style={{ fontSize: '18px' }} />} color="blue">
                            <Title level={4}>The Idea (CSE299)</Title>
                            <Paragraph>What if we could use modern AI to automate the most painful parts? An idea for a final-year project was born.</Paragraph>
                        </Timeline.Item>
                        <Timeline.Item dot={<ThunderboltOutlined style={{ fontSize: '18px' }} />} color="#007B7B">
                            <Title level={4}>The Technology</Title>
                            <Paragraph>Built with a modern stack: React & Ant Design on the frontend, Node.js & Express on the backend, and Google's Gemini AI for intelligence.</Paragraph>
                        </Timeline.Item>
                        <Timeline.Item dot={<FlagOutlined style={{ fontSize: '18px' }} />} color="green">
                            <Title level={4}>The Result</Title>
                            <Paragraph>A smart, fast, and intuitive resume builder that empowers users to create their best-possible resume.</Paragraph>
                        </Timeline.Item>
                    </Timeline>
                </div>
            </motion.section>

            {/* --- 4. FAQ Section (Accordion) --- */}
            <motion.section 
                style={{ padding: '80px 40px', maxWidth: '900px', margin: 'auto' }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={sectionFadeIn}
            >
                <Title level={2} style={{ textAlign: 'center', marginBottom: '60px' }}>
                    Frequently Asked Questions
                </Title>
                <Collapse accordion size="large" bordered={false} style={{ backgroundColor: '#fff' }}>
                    {faqItems.map(item => (
                        <Panel header={item.label} key={item.key} style={{ fontSize: '16px', fontWeight: 500 }}>
                            <Paragraph style={{ fontSize: '16px', color: '#555' }}>{item.content}</Paragraph>
                        </Panel>
                    ))}
                </Collapse>
            </motion.section>

            {/* --- 5. Final Call to Action --- */}
            <motion.section 
                style={{ 
                    backgroundColor: '#007B7B', 
                    padding: '80px 40px', 
                    textAlign: 'center',
                    color: '#fff'
                }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={sectionFadeIn}
            >
                <Title level={1} style={{ color: '#fff', fontWeight: 700, marginBottom: '20px' }}>
                    Ready to land your next job?
                </Title>
                <Paragraph style={{ fontSize: '18px', maxWidth: '600px', margin: 'auto', color: '#f0f9f9', marginBottom: '30px' }}>
                    Stop worrying about formatting and wording. Let our AI help you build a resume that stands out.
                </Paragraph>
                <motion.div
                    style={{ display: 'inline-block' }}
                    variants={buttonHover}
                    whileHover="hover"
                >
                    <Button 
                        type="primary"
                        size="large" 
                        style={{ 
                            height: '50px', 
                            fontSize: '18px', 
                            padding: '0 32px',
                            backgroundColor: '#fff', // White button on teal bg
                            color: '#007B7B', // Teal text
                            fontWeight: 'bold',
                            border: 'none'
                        }}
                        onClick={() => navigate('/register')}
                    >
                        Get Started for Free
                    </Button>
                </motion.div>
            </motion.section>

        </Layout.Content>
    );
};

export default AboutPage;