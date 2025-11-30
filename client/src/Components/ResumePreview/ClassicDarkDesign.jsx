import React from 'react';
import { Button, Typography, Space, Divider, Tag } from 'antd';
import { 
    EditOutlined, 
    MailOutlined, 
    PhoneOutlined, 
    LinkedinOutlined, 
    HomeOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// --- Sub-Components ---

const DarkBulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        <ul className="list-disc list-inside space-y-1 mt-2 !text-gray-300 ml-5 leading-relaxed">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const DarkExperiencePreview = ({ item }) => (
    <div className="mb-6">
        <div className="flex justify-between items-baseline">
            <div>
                <Title level={5} className="!text-white mb-0 text-lg">
                    {item.title || 'Job Title'}
                </Title>
                <Text className="!text-indigo-400 font-medium block mt-1">
                    {item.company || 'Company Name'}
                </Text>
            </div>
            <Text className="!text-gray-400 flex-shrink-0 ml-4 text-sm font-medium bg-gray-800 px-2 py-1 rounded">
                {item.startDate} - {item.endDate}
            </Text>
        </div>
        <DarkBulletPoints text={item.description} />
    </div>
);

const DarkEducationPreview = ({ item }) => (
    <div className="mb-5">
        <div className="flex justify-between items-start">
            <div>
                <Title level={5} className="!text-white mb-0 text-lg">
                    {item.degree || 'Degree'}
                </Title>
                <Text className="!text-indigo-400 font-medium italic mt-1 block">
                    {item.institution || 'Institution Name'}
                </Text>
            </div>
            <Text className="!text-gray-400 flex-shrink-0 ml-4 text-sm bg-gray-800 px-2 py-1 rounded">
                {item.startYear} - {item.endYear}
            </Text>
        </div>
    </div>
);

// --- Main Template ---

const ClassicDarkDesign = ({ data, onEditSection }) => {
    const primaryColor = '!text-indigo-400';
    
    const EditButton = ({ section }) => (
        <Button
            type="primary"
            shape="circle"
            icon={<EditOutlined />}
            onClick={() => onEditSection(section)}
            className="print:!hidden absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ zIndex: 10 }}
        />
    );

    const SectionTitle = ({ title }) => (
        <Title level={4} className={`${primaryColor} border-b border-gray-700 pb-2 mb-4 uppercase tracking-widest text-sm font-bold`}>
            {title}
        </Title>
    );

    return (
        <div className="text-gray-300 font-sans"> 
            {/* Header / Personal Info */}
            <div className="relative mb-8"> 
                <EditButton section="personal" /> 
                <header className="text-center pb-4">
                    
                    {/* --- PROFILE PICTURE --- */}
                    {data.personal.profilePic && (
                        <div className="mb-6 flex justify-center">
                            <img 
                                src={data.personal.profilePic} 
                                alt="Profile" 
                                className="w-32 h-32 rounded-full object-cover border-4 border-gray-800 shadow-xl"
                            />
                        </div>
                    )}

                    <Title level={1} className="!text-white mb-2 text-4xl font-light tracking-wide">
                        {data.personal.name || 'Your Name'}
                    </Title>
                    <Title level={4} className={`${primaryColor} mt-0 mb-4 font-medium uppercase tracking-wider text-base`}>
                        {data.personal.title || 'Professional Title'}
                    </Title>
                    
                    <Space size="large" wrap className="justify-center !text-gray-400 text-sm">
                        <Space><PhoneOutlined /> {data.personal.phone}</Space>
                        <Space><MailOutlined /> <span className="break-all">{data.personal.email}</span></Space>
                        <Space><HomeOutlined /> {data.personal.city}</Space>
                        <Space><LinkedinOutlined /> {data.personal.linkedin}</Space>
                    </Space>
                </header>
                <Divider className="my-0 bg-gray-700" />
            </div>

            {/* Summary */}
            <div className="relative mb-8"> 
                <EditButton section="summary" /> 
                <section>
                    <SectionTitle title="About Me" />
                    {data.summary ? (
                        <Paragraph className="!text-gray-300 leading-7 text-justify text-base">
                            {data.summary}
                        </Paragraph>
                    ) : (
                        <Text type="secondary" italic className="!text-gray-500">Click the edit icon to add a professional summary.</Text>
                    )}
                </section>
            </div>

            {/* Experience */}
            <div className="relative mb-8"> 
                <EditButton section="experience" /> 
                <section>
                    <SectionTitle title="Experience" />
                    {(data.experience && data.experience.length > 0) ? (
                        data.experience.map(item => <DarkExperiencePreview key={item.id} item={item} />)
                    ) : (
                        <Text type="secondary" italic className="!text-gray-500">Click the edit icon to add your work experience.</Text>
                    )}
                </section>
            </div>

            {/* Education */}
            <div className="relative mb-8"> 
                <EditButton section="education" /> 
                <section>
                    <SectionTitle title="Education" />
                    {(data.education && data.education.length > 0) ? (
                        data.education.map(item => <DarkEducationPreview key={item.id} item={item} />)
                    ) : (
                         <Text type="secondary" italic className="!text-gray-500">Click the edit icon to add your education.</Text>
                    )}
                </section>
            </div>

            {/* Skills */}
            <div className="relative"> 
                <EditButton section="skills" /> 
                <section>
                    <SectionTitle title="Expertise" />
                    {(data.skills && data.skills.trim()) ? (
                        <div className="flex flex-wrap gap-2">
                            {data.skills.split(',').map(skill => (
                                <Tag key={skill.trim()} color="indigo" className="px-3 py-1 text-sm border-0 rounded-full">
                                    {skill.trim()}
                                </Tag>
                            ))}
                        </div>
                    ) : (
                        <Text type="secondary" italic className="!text-gray-500">Click the edit icon to add your skills.</Text>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ClassicDarkDesign;