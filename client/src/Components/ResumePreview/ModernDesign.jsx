import React from 'react';
import { Button, Typography, Space, Divider, Tag, Descriptions } from 'antd';
import { 
    EditOutlined, 
    MailOutlined, 
    PhoneOutlined, 
    LinkedinOutlined, 
    HomeOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph, Link } = Typography;

// --- Sub-Components ---
const BulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        <ul className="list-disc list-inside space-y-1 mt-1 text-gray-700 dark:text-gray-300 ml-5 text-sm">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const MainSectionTitle = ({ title }) => (
    <Title level={4} className="text-gray-800 dark:text-white border-b-2 border-indigo-200 dark:border-indigo-700 pb-1 mb-4 uppercase tracking-wider">
        {title}
    </Title>
);

const ModernExperiencePreview = ({ item }) => (
    <div className="mb-5">
        <div className="flex justify-between items-start">
            <Title level={5} className="text-indigo-700 dark:text-indigo-400 mb-0">
                {item.title || 'Job Title'} @ {item.company || 'Company Name'}
            </Title>
            <Text type="secondary" className="flex-shrink-0 ml-4 italic">
                {item.startDate} - {item.endDate}
            </Text>
        </div>
        <BulletPoints text={item.description} />
    </div>
);

const ModernEducationPreview = ({ item }) => (
    <div className="mb-5">
        <div className="flex justify-between items-start">
            <Title level={5} className="text-gray-800 dark:text-white mb-0">
                {item.degree || 'Degree'}
            </Title>
            <Text type="secondary" className="flex-shrink-0 ml-4 italic">
                {item.startYear} - {item.endYear}
            </Text>
        </div>
        <Text italic className="text-sm text-gray-600 dark:text-gray-400">
            {item.institution || 'Institution Name'}
        </Text>
    </div>
);

// --- Main Template ---

const ModernDesign = ({ data, onEditSection }) => {
    
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

    const contactItems = [
        { key: '1', label: <MailOutlined />, children: data.personal.email },
        { key: '2', label: <PhoneOutlined />, children: data.personal.phone },
        { key: '3', label: <HomeOutlined />, children: data.personal.city },
        { key: '4', label: <LinkedinOutlined />, children: <Link href={`https://${data.personal.linkedin}`} target="_blank">{data.personal.linkedin}</Link> },
    ];

    return (
        <div className="grid grid-cols-4 gap-6 min-h-[11in] print:min-h-screen">
            {/* Left Column (1/4 width) - Contact & Skills */}
            <div className="col-span-1 bg-indigo-50 dark:bg-gray-700 p-4 pt-6 border-r border-indigo-200 dark:border-indigo-600">
                
                <div className="relative"> 
                    <EditButton section="personal" /> 
                    
                    {/* --- CONDITIONAL PROFILE PICTURE --- */}
                    {data.personal.profilePic && (
                        <div className="mb-6 flex justify-center">
                            <img 
                                src={data.personal.profilePic} 
                                alt="Profile" 
                                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-sm"
                            />
                        </div>
                    )}
                    {/* ----------------------------------- */}

                    <header className="mb-6">
                        <Title level={2} className="text-gray-900 dark:text-white mb-1">
                            {data.personal.name || 'Your Name'}
                        </Title>
                        <Title level={5} className="text-indigo-700 dark:text-indigo-400 font-medium mt-0">
                            {data.personal.title || 'Professional Title'}
                        </Title>
                    </header>
                </div>

                <Divider className="my-4" />

                <section className="mb-6">
                    <Title level={5} className="text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-3">Contact</Title>
                    <Descriptions column={1} size="small" layout="horizontal" className="text-xs">
                        {contactItems.map(item => (
                            <Descriptions.Item key={item.key} labelStyle={{ padding: 0 }} contentStyle={{ padding: 0, fontSize: '12px' }} label={item.label}>
                                {item.children}
                            </Descriptions.Item>
                        ))}
                    </Descriptions>
                </section>

                <div className="relative"> 
                    <EditButton section="skills" /> 
                    <section className="mb-6">
                        <Title level={5} className="text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-3">Skills</Title>
                        {(data.skills && data.skills.trim()) ? (
                            <Space size={[4, 8]} wrap>
                                {data.skills.split(',').map(skill => (
                                    <Tag key={skill.trim()}>{skill.trim()}</Tag>
                                ))}
                            </Space>
                        ) : (
                            <Text type="secondary" italic>Add skills...</Text>
                        )}
                    </section>
                </div>
            </div>

            {/* Right Column (3/4 width) - Content */}
            <div className="col-span-3 p-4 pt-6">
                
                <div className="relative"> 
                    <EditButton section="summary" /> 
                    <section className="mb-6">
                        <MainSectionTitle title="About Me" />
                        {data.summary ? (
                            <Paragraph className="text-sm text-gray-700 dark:text-gray-300">{data.summary}</Paragraph>
                        ) : (
                            <Text type="secondary" italic>Click the edit icon to add a summary.</Text>
                        )}
                    </section>
                </div>

                <div className="relative"> 
                    <EditButton section="experience" /> 
                    <section className="mb-6">
                        <MainSectionTitle title="Experience" />
                        {(data.experience && data.experience.length > 0) ? (
                            data.experience.map(item => <ModernExperiencePreview key={item.id} item={item} />)
                        ) : (
                            <Text type="secondary" italic>Click the edit icon to add experience.</Text>
                        )}
                    </section>
                </div>

                <div className="relative"> 
                    <EditButton section="education" /> 
                    <section className="mb-6">
                        <MainSectionTitle title="Education" />
                        {(data.education && data.education.length > 0) ? (
                            data.education.map(item => <ModernEducationPreview key={item.id} item={item} />)
                        ) : (
                            <Text type="secondary" italic>Click the edit icon to add education.</Text>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ModernDesign;