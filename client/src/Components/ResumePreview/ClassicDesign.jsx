import React from 'react';
import { Button, Typography, Space, Divider, Tag } from 'antd';
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
        <ul className="list-disc list-inside space-y-1 mt-2 text-gray-700 ml-5 leading-relaxed">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const ExperiencePreview = ({ item }) => (
    <div className="mb-6">
        <div className="flex justify-between items-baseline mb-1">
            <div>
                <Title level={5} className="text-gray-900 mb-0 text-lg font-bold">
                    {item.title || 'Job Title'}
                </Title>
                <Text className="text-indigo-700 font-semibold block">
                    {item.company || 'Company Name'}
                </Text>
            </div>
            <Text className="text-gray-500 flex-shrink-0 text-sm font-medium">
                {item.startDate} - {item.endDate}
            </Text>
        </div>
        <BulletPoints text={item.description} />
    </div>
);

const EducationPreview = ({ item }) => (
    <div className="mb-5">
        <div className="flex justify-between items-start">
            <div>
                <Title level={5} className="text-gray-900 mb-0 text-lg font-bold">
                    {item.degree || 'Degree'}
                </Title>
                <Text className="text-indigo-700 font-medium italic mt-1 block">
                    {item.institution || 'Institution Name'}
                </Text>
            </div>
            <Text className="text-gray-500 flex-shrink-0 text-sm font-medium">
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
        <Title level={4} className="text-gray-800 border-b-2 border-gray-200 pb-2 mb-4 uppercase tracking-widest text-sm font-bold">
            {title}
        </Title>
    );

    return (
        <div className="font-serif text-gray-800"> 
            {/* Header / Personal Info */}
            <div className="relative mb-8"> 
                <EditButton section="personal" /> 
                <header className="text-center pb-6">
                    
                    {/* --- CONDITIONAL PROFILE PICTURE --- */}
                    {data.personal.profilePic && (
                        <div className="mb-6 flex justify-center">
                            <img 
                                src={data.personal.profilePic} 
                                alt="Profile" 
                                className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow-sm"
                            />
                        </div>
                    )}

                    <Title level={1} className="text-gray-900 mb-2 text-4xl font-serif tracking-tight">
                        {data.personal.name || 'Your Name'}
                    </Title>
                    <Title level={4} className="text-indigo-700 mt-0 mb-4 font-sans font-bold uppercase tracking-widest text-sm">
                        {data.personal.title || 'Professional Title'}
                    </Title>
                    
                    <Space size="large" wrap className="justify-center text-gray-500 font-sans text-sm">
                        <Space><PhoneOutlined /> {data.personal.phone}</Space>
                        <Space><MailOutlined /> <span className="break-all">{data.personal.email}</span></Space>
                        <Space><HomeOutlined /> {data.personal.city}</Space>
                        <Space><LinkedinOutlined /> <Link href={`https://${data.personal.linkedin}`} target="_blank" className="text-gray-500 hover:text-indigo-600">{data.personal.linkedin}</Link></Space>
                    </Space>
                </header>
                <Divider className="my-0" />
            </div>

            {/* Content Sections */}
            <div className="font-sans">
                {/* Summary */}
                <div className="relative mb-8"> 
                    <EditButton section="summary" /> 
                    <section>
                        <SectionTitle title="About Me" />
                        {data.summary ? (
                            <Paragraph className="text-gray-700 leading-7 text-justify text-base">
                                {data.summary}
                            </Paragraph>
                        ) : (
                            <Text type="secondary" italic>Click the edit icon to add a professional summary.</Text>
                        )}
                    </section>
                </div>

                {/* Experience */}
                <div className="relative mb-8"> 
                    <EditButton section="experience" /> 
                    <section>
                        <SectionTitle title="Experience" />
                        {(data.experience && data.experience.length > 0) ? (
                            data.experience.map(item => <ExperiencePreview key={item.id} item={item} />)
                        ) : (
                            <Text type="secondary" italic>Click the edit icon to add your work experience.</Text>
                        )}
                    </section>
                </div>

                {/* Education */}
                <div className="relative mb-8"> 
                    <EditButton section="education" /> 
                    <section>
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
                        <SectionTitle title="Expertise" />
                        {(data.skills && data.skills.trim()) ? (
                            <div className="flex flex-wrap gap-2">
                                {data.skills.split(',').map(skill => (
                                    <Tag key={skill.trim()} color="blue" className="px-3 py-1 text-sm border-0 rounded-md bg-blue-50 text-blue-700 font-medium">
                                        {skill.trim()}
                                    </Tag>
                                ))}
                            </div>
                        ) : (
                            <Text type="secondary" italic>Click the edit icon to add your skills.</Text>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ClassicDesign;