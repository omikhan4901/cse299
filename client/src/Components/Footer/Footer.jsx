import React from 'react';
import { Layout, Row, Col, Typography, Space, Button, Divider } from 'antd';
import { 
    GithubOutlined, 
    LinkedinFilled, 
    HeartFilled,
    RobotOutlined
} from '@ant-design/icons';
import { useRouter } from '../../Context/context-definitions';

const { Text, Link } = Typography;
const { Footer: AntFooter } = Layout;

const Footer = () => {
    const { navigate } = useRouter();

    return (
        <AntFooter style={{ background: '#002A3A', color: '#fff', padding: '48px 24px 24px', zIndex: 25 }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                
                <Row gutter={[32, 32]}>
                    {/* Column 1: Brand & Mission */}
                    <Col xs={24} md={8}>
                        <Space align="center" style={{ marginBottom: 16 }}>
                            <RobotOutlined style={{ fontSize: '24px', color: '#007B7B' }} />
                            <Text style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>ResumeX</Text>
                        </Space>
                        <Paragraph style={{ color: 'rgba(255,255,255,0.65)' }}>
                            An AI-powered career assistant built to help students and professionals land their dream jobs with less stress.
                        </Paragraph>
                    </Col>

                    {/* Column 2: Quick Links */}
                    <Col xs={24} md={8}>
                        <Title level={5} style={{ color: '#fff', marginBottom: 24 }}>Quick Links</Title>
                        <Space direction="vertical" size="middle">
                            <Link onClick={() => navigate('/')} style={{ color: 'rgba(255,255,255,0.85)' }}>Home</Link>
                            <Link onClick={() => navigate('/builder')} style={{ color: 'rgba(255,255,255,0.85)' }}>Resume Builder</Link>
                            <Link onClick={() => navigate('/about')} style={{ color: 'rgba(255,255,255,0.85)' }}>About Us</Link>
                        </Space>
                    </Col>

                    {/* Column 3: The Developers (Credits) */}
                    <Col xs={24} md={8}>
                        <Title level={5} style={{ color: '#fff', marginBottom: 24 }}>Built By</Title>
                        
                        {/* Mehboob */}
                        <div style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>Mehboob Ehsan Khan</Text>
                            <Space>
                                <Link href="https://github.com/omikhan4901" target="_blank" style={{ color: 'rgba(255,255,255,0.65)' }}>
                                    <GithubOutlined /> GitHub
                                </Link>
                            </Space>
                        </div>

                        {/* Nabigah */}
                        <div>
                            <Text strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>Nabigah Bin Sayeed</Text>
                            <Space>
                                <Link href="https://github.com/Nabigah274" target="_blank" style={{ color: 'rgba(255,255,255,0.65)' }}>
                                    <GithubOutlined /> GitHub
                                </Link>
                            </Space>
                        </div>
                    </Col>
                </Row>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '32px 0' }} />

                <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
                        © {new Date().getFullYear()} ResumeX. Built with <HeartFilled style={{ color: '#ff4d4f' }} /> for CSE299.
                    </Text>
                </div>
            </div>
        </AntFooter>
    );
};

// Use Paragraph from Typography so we don't need to import it separately if we used it above
const { Title, Paragraph } = Typography;

export default Footer;