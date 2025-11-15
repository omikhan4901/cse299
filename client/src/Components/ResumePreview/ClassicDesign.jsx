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

const BulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        <ul className="list-disc list-inside space-y-1 mt-2 text-gray-700 dark:text-gray-300 ml-5">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const ExperiencePreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <Title level={5} className="text-gray-800 dark:text-white mb-0">
                    {item.title || 'Job Title'}
                </Title>
                <Text italic className="text-gray-600 dark:text-gray-400">
                    {item.company || 'Company Name'}
                </Text>
            </div>
            <Text type="secondary" className="flex-shrink-0 ml-4">
                {item.startDate} - {item.endDate}
            </Text>
        </div>
        <BulletPoints text={item.description} />
    </div>
);

const EducationPreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <Title level={5} className="text-gray-800 dark:text-white mb-0">
                    {item.degree || 'Degree'}
                </Title>
                <Text italic className="text-gray-600 dark:text-gray-400">
                    {item.institution || 'Institution Name'}
                </Text>
            </div>
            <Text type="secondary" className="flex-shrink-0 ml-4">
                {item.startYear} - {item.endYear}
            </Text>
        </div>
    </div>
);

// --- Main Template ---

const ClassicDesign = ({ data, onEditSection }) => {
    
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
        <Title level={4} className="text-indigo-700 dark:text-indigo-400 border-b border-gray-300 dark:border-gray-700 pb-1 mb-3 uppercase tracking-wider">
            {title}
        </Title>
    );

    return (
        <> 
            {/* Header / Personal Info */}
            <div className="relative"> 
                <EditButton section="personal" /> 
                <header className="text-center pb-4 mb-4">
                    <Title level={1} className="text-gray-900 dark:text-white mb-1">
                        {data.personal.name || 'Your Name'}
                    </Title>
                    <Title level={4} className="text-indigo-700 dark:text-indigo-400 mt-0 mb-3 font-medium">
                        {data.personal.title || 'Professional Title'}
                    </Title>
                    <Space size="middle" wrap className="justify-center text-gray-600 dark:text-gray-400">
                        <Space><PhoneOutlined /> {data.personal.phone}</Space>
                        <Space><MailOutlined /> {data.personal.email}</Space>
                        <Space><HomeOutlined /> {data.personal.city}</Space>
                        <Space><LinkedinOutlined /> {data.personal.linkedin}</Space>
                    </Space>
                </header>
                <Divider className="my-0" />
            </div>

            {/* Summary */}
            <div className="relative mt-4"> 
                <EditButton section="summary" /> 
                <section className="mb-4">
                    <SectionTitle title="Summary" />
                    {data.summary ? (
                        <Paragraph className="text-sm text-gray-700 dark:text-gray-300">{data.summary}</Paragraph>
                    ) : (
                        <Text type="secondary" italic>Click the edit icon to add a professional summary.</Text>
                    )}
                </section>
            </div>

            {/* Experience */}
            <div className="relative"> 
                <EditButton section="experience" /> 
                <section className="mb-4">
                    <SectionTitle title="Experience" />
                    {(data.experience && data.experience.length > 0) ? (
                        data.experience.map(item => <ExperiencePreview key={item.id} item={item} />)
                    ) : (
                        <Text type="secondary" italic>Click the edit icon to add your work experience.</Text>
                    )}
                </section>
            </div>

            {/* Education */}
            <div className="relative"> 
                <EditButton section="education" /> 
                <section className="mb-4">
                    <SectionTitle title="Education" />
                    {(data.education && data.education.length > 0) ? (
                        data.education.map(item => <EducationPreview key={item.id} item={item} />)
                    ) : (
                         <Text type="secondary" italic>Click the edit icon to add your education.</Text>
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
                                <Tag key={skill.trim()} color="blue">{skill.trim()}</Tag>
                            ))}
                        </Space>
                    ) : (
                        <Text type="secondary" italic>Click the edit icon to add your skills.</Text>
                    )}
                </section>
            </div>
        </>
    );
};

export default ClassicDesign;