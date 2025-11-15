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

// --- Sub-Components (Polished) ---

const DarkBulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        // FIX: Brighter text
        <ul className="list-disc list-inside space-y-1 mt-2 text-gray-200 ml-5">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const DarkExperiencePreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <Title level={5} className="text-white mb-0">
                    {item.title || 'Job Title'}
                </Title>
                <Text italic className="text-gray-400">
                    {item.company || 'Company Name'}
                </Text>
            </div>
            {/* FIX: Brighter text */}
            <Text className="text-gray-400 flex-shrink-0 ml-4">
                {item.startDate} - {item.endDate}
            </Text>
        </div>
        <DarkBulletPoints text={item.description} />
    </div>
);

const DarkEducationPreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <Title level={5} className="text-white mb-0">
                    {item.degree || 'Degree'}
                </Title>
                <Text italic className="text-gray-400">
                    {item.institution || 'Institution Name'}
                </Text>
            </div>
            {/* FIX: Brighter text */}
            <Text className="text-gray-400 flex-shrink-0 ml-4">
                {item.startYear} - {item.endYear}
            </Text>
        </div>
    </div>
);

// --- Main Template ---

const ClassicDarkDesign = ({ data, onEditSection }) => {
    const primaryColor = 'text-indigo-400';
    
    const EditButton = ({ section }) => (
        <Button
            type="primary"
            shape="circle"
            icon={<EditOutlined />}
            onClick={() => onEditSection(section)}
            className="print:hidden absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ zIndex: 10 }}
        />
    );

    const SectionTitle = ({ title }) => (
        <Title level={4} className={`${primaryColor} border-b border-gray-700 pb-1 mb-3 uppercase tracking-wider`}>
            {title}
        </Title>
    );

    return (
        <> 
            {/* Header / Personal Info */}
            <div className="relative"> 
                <EditButton section="personal" /> 
                <header className="text-center pb-4 mb-4">
                    <Title level={1} className="text-white mb-1">
                        {data.personal.name || 'Your Name'}
                    </Title>
                    <Title level={4} className={`${primaryColor} mt-0 mb-3 font-medium`}>
                        {data.personal.title || 'Professional Title'}
                    </Title>
                    <Space size="middle" wrap className="justify-center text-gray-400">
                        <Space><PhoneOutlined /> {data.personal.phone}</Space>
                        <Space><MailOutlined /> {data.personal.email}</Space>
                        <Space><HomeOutlined /> {data.personal.city}</Space>
                        <Space><LinkedinOutlined /> {data.personal.linkedin}</Space>
                    </Space>
                </header>
                <Divider className="my-0 bg-gray-700" />
            </div>

            {/* Summary */}
            <div className="relative mt-4"> 
                <EditButton section="summary" /> 
                <section className="mb-4">
                    <SectionTitle title="Summary" />
                    {data.summary ? (
                        // FIX: Brighter body text
                        <Paragraph className="text-sm text-gray-100">{data.summary}</Paragraph>
                    ) : (
                        // FIX: Brighter placeholder
                        <Text className="text-gray-500" italic>Click the edit icon to add a professional summary.</Text>
                    )}
                </section>
            </div>

            {/* Experience */}
            <div className="relative"> 
                <EditButton section="experience" /> 
                <section className="mb-4">
                    <SectionTitle title="Experience" />
                    {(data.experience && data.experience.length > 0) ? (
                        data.experience.map(item => <DarkExperiencePreview key={item.id} item={item} />)
                    ) : (
                        // FIX: Brighter placeholder
                        <Text className="text-gray-500" italic>Click the edit icon to add your work experience.</Text>
                    )}
                </section>
            </div>

            {/* Education */}
            <div className="relative"> 
                <EditButton section="education" /> 
                <section className="mb-4">
                    <SectionTitle title="Education" />
                    {(data.education && data.education.length > 0) ? (
                        data.education.map(item => <DarkEducationPreview key={item.id} item={item} />)
                    ) : (
                         // FIX: Brighter placeholder
                         <Text className="text-gray-500" italic>Click the edit icon to add your education.</Text>
                    )}
                </section>
            </div>

            {/* Skills */}
            <div className="relative"> 
                <EditButton section="skills" /> 
                <section>
                    <SectionTitle title="Skills" />
                    {(data.skills && data.skills.trim()) ? (
                        <Space size={[8, 16]} wrap>
                            {data.skills.split(',').map(skill => (
                                <Tag key={skill.trim()} color="indigo">{skill.trim()}</Tag>
                            ))}
                        </Space>
                    ) : (
                        // FIX: Brighter placeholder
                        <Text className="text-gray-500" italic>Click the edit icon to add your skills.</Text>
                    )}
                </section>
            </div>
        </>
    );
};

export default ClassicDarkDesign;