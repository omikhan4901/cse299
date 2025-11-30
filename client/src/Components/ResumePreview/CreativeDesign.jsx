import React from 'react';
import { Button, Typography, Space, Tag, Row, Col } from 'antd';
import { 
    EditOutlined, 
    MailOutlined, 
    PhoneOutlined, 
    LinkedinOutlined, 
    HomeOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph, Link } = Typography;

const CreativeDesign = ({ data, onEditSection }) => {
    
    const EditButton = ({ section, light = false }) => (
        <Button
            type="primary"
            shape="circle"
            icon={<EditOutlined />}
            onClick={() => onEditSection(section)}
            className="print:hidden absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ zIndex: 20, backgroundColor: light ? 'rgba(255,255,255,0.2)' : undefined }}
        />
    );

    return (
        <div className="min-h-[11in] bg-white text-gray-800 font-sans print:min-h-screen relative pb-12">
            
            {/* --- 1. HERO BANNER --- */}
            {/* FIX: Added 'z-0' to keep it below the floating card */}
            <div className="relative z-0 bg-[#2D3748] h-64 print:h-56 flex flex-col justify-center items-center overflow-hidden">
                <EditButton section="personal" light />
                
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10" 
                     style={{ 
                         backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', 
                         backgroundSize: '24px 24px' 
                     }}>
                </div>

                {/* Name */}
                <div className="z-10 text-center mb-12">
                    <Title level={1} className="!text-white tracking-[0.2em] uppercase m-0 text-4xl font-light">
                        {data.personal.name || 'YOUR NAME'}
                    </Title>
                </div>
            </div>

            {/* --- 2. FLOATING INFO BAR --- */}
            {/* FIX: Added 'z-10' to force this layer ON TOP of the banner */}
            <div className="relative z-10 -mt-16 px-12 mb-12">
                <div className="bg-white shadow-xl p-6 rounded-xl flex justify-between items-start print:shadow-none print:border print:border-gray-300">
                    
                    {/* Left: Contact Info */}
                    <Space direction="vertical" size={6} className="text-sm mt-4">
                        <Space ><MailOutlined className="text-blue-500" /> <span className="break-all">{data.personal.email}</span></Space>
                        <Space><PhoneOutlined className="text-blue-500" /> {data.personal.phone}</Space>
                    </Space>

                    {/* Center: Profile Picture & Title */}
                    <div className="flex flex-col items-center -mt-24">
                        {data.personal.profilePic ? (
                            <img 
                                src={data.personal.profilePic} 
                                alt="Profile" 
                                className="w-40 h-40 rounded-full border-[6px] border-white shadow-lg object-cover bg-white"
                            />
                        ) : (
                            <div className="w-32 h-32 rounded-full border-[6px] border-white shadow-lg bg-gray-200"></div>
                        )}
                        
                        {/* Title */}
                        <Text className="text-blue-600 font-bold tracking-widest uppercase mt-4 text-center">
                            {data.personal.title || 'Professional Title'}
                        </Text>
                    </div>

                    {/* Right: Location & Social */}
                    <Space direction="vertical" size={6} className="text-sm items-end mt-4">
                        <Space>{data.personal.city} <HomeOutlined className="text-blue-500" /></Space>
                        <Space><Link href={`https://${data.personal.linkedin}`} target="_blank">{data.personal.linkedin}</Link> <LinkedinOutlined className="text-blue-500" /></Space>
                    </Space>
                </div>
            </div>

            {/* --- 3. MAIN CONTENT --- */}
            <div className="px-12">
                <Row gutter={48}>
                    {/* LEFT COLUMN (2/3) */}
                    <Col span={16}>
                        
                        {/* About Me */}
                        <div className="relative mb-10 break-inside-avoid">
                            <EditButton section="summary" />
                            <h3 className="text-xl font-bold text-gray-800 uppercase border-b-2 border-gray-200 pb-2 mb-4 tracking-wider">
                                About Me
                            </h3>
                            <Paragraph className="text-gray-600 leading-7 text-justify">
                                {data.summary || 'Add a summary to introduce yourself...'}
                            </Paragraph>
                        </div>

                        {/* Experience */}
                        <div className="relative mb-8">
                            <EditButton section="experience" />
                            <h3 className="text-xl font-bold text-gray-800 uppercase border-b-2 border-gray-200 pb-2 mb-6 tracking-wider">
                                Experience
                            </h3>
                            
                            {(data.experience || []).map(item => (
                                <div key={item.id} className="mb-8 relative pl-6 border-l-2 border-gray-200 break-inside-avoid">
                                    {/* Timeline Dot */}
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-4 border-blue-500 rounded-full"></div>
                                    
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className="text-lg font-bold text-gray-800 m-0">{item.title}</h4>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded">
                                            {item.startDate} - {item.endDate}
                                        </span>
                                    </div>
                                    
                                    <div className="text-blue-600 font-semibold mb-3">{item.company}</div>
                                    
                                    {/* Clean Bullet Points */}
                                    <ul className="list-none ml-0 space-y-2 text-gray-600 text-sm leading-relaxed">
                                        {item.description && item.description.split('\n').map((line, i) => line && (
                                            <li key={i} className="relative pl-4">
                                                <span className="absolute left-0 top-2 w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                                                {line.replace(/^[•-]\s*/, '')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </Col>

                    {/* RIGHT COLUMN (1/3) */}
                    <Col span={8}>
                        {/* Education */}
                        <div className="relative mb-12 break-inside-avoid">
                            <EditButton section="education" />
                            <h3 className="text-xl font-bold text-gray-800 uppercase border-b-2 border-gray-200 pb-2 mb-6 tracking-wider">
                                Education
                            </h3>
                            {(data.education || []).map(item => (
                                <div key={item.id} className="mb-6">
                                    <h4 className="text-base font-bold text-gray-800 m-0">{item.degree}</h4>
                                    <div className="text-blue-600 font-medium text-sm mt-1 mb-2 uppercase">{item.institution}</div>
                                    <Tag className="bg-gray-100 border-gray-200 text-gray-500 rounded-full px-3">
                                        {item.startYear} - {item.endYear}
                                    </Tag>
                                </div>
                            ))}
                        </div>

                        {/* Skills */}
                        <div className="relative break-inside-avoid">
                            <EditButton section="skills" />
                            <h3 className="text-xl font-bold text-gray-800 uppercase border-b-2 border-gray-200 pb-2 mb-6 tracking-wider">
                                Expertise
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {data.skills ? data.skills.split(',').map(skill => (
                                    <Tag 
                                        key={skill} 
                                        className="px-3 py-1.5 text-sm rounded-md m-0 bg-blue-50 text-blue-700 border-blue-100 font-medium"
                                    >
                                        {skill.trim()}
                                    </Tag>
                                )) : <Text type="secondary">Add skills...</Text>}
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default CreativeDesign;