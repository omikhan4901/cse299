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

const BulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        <ul className="list-disc list-inside space-y-1 mt-2 !text-gray-300 ml-5 text-sm leading-relaxed">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const MainSectionTitle = ({ title }) => (
    <Title level={4} className="!text-indigo-400 border-b-2 border-indigo-900 pb-2 mb-6 uppercase tracking-widest text-sm font-bold">
        {title}
    </Title>
);

const ModernDarkExperiencePreview = ({ item }) => (
    <div className="mb-8 relative pl-6 border-l-2 border-indigo-900 break-inside-avoid">
        <div className="absolute -left-[9px] top-1 w-4 h-4 bg-gray-900 border-2 border-indigo-500 rounded-full"></div>
        <div className="flex justify-between items-baseline mb-1">
            <Title level={5} className="!text-white mb-0 text-lg">
                {item.title || 'Job Title'}
            </Title>
            <Text className="!text-gray-400 flex-shrink-0 text-xs font-bold uppercase tracking-wider">
                {item.startDate} - {item.endDate}
            </Text>
        </div>
        <div className="!text-indigo-400 font-medium mb-2">{item.company}</div>
        <BulletPoints text={item.description} />
    </div>
);

const ModernDarkEducationPreview = ({ item }) => (
    <div className="mb-6 break-inside-avoid">
        <div className="flex justify-between items-start">
            <Title level={5} className="!text-white mb-0 text-lg">
                {item.degree || 'Degree'}
            </Title>
            <Text className="!text-gray-400 flex-shrink-0 text-sm bg-gray-800 px-2 py-1 rounded">
                {item.startYear} - {item.endYear}
            </Text>
        </div>
        <Text italic className="text-sm !text-indigo-400 mt-1 block">
            {item.institution || 'Institution Name'}
        </Text>
    </div>
);

// --- Main Template ---

const ModernDarkDesign = ({ data, onEditSection, editingSection }) => {
    
    // Helper
    const getSectionClass = (sectionName) => {
        const isActive = editingSection === sectionName;
        // Dark theme specific highlight
        return `relative transition-all duration-300 rounded-lg ${isActive ? 'ring-2 ring-indigo-400 bg-indigo-500/10 p-2 -m-2' : ''}`;
    };

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

    const contactItems = [
        { key: '1', label: <MailOutlined />, children: <span className="break-all">{data.personal.email}</span> },
        { key: '2', label: <PhoneOutlined />, children: data.personal.phone },
        { key: '3', label: <HomeOutlined />, children: data.personal.city },
        { key: '4', label: <LinkedinOutlined />, children: <Link href={`https://${data.personal.linkedin}`} target="_blank" className="!text-indigo-400">{data.personal.linkedin}</Link> },
    ];

    return (
        <div className="grid grid-cols-4 gap-0 min-h-[11in] print:min-h-screen">
            {/* Left Column (Sidebar) */}
            <div className="col-span-1 bg-[#1f2937] p-6 pt-8 border-r border-gray-700">
                
                <div className={getSectionClass('personal')}> 
                    <EditButton section="personal" /> 
                    
                    {/* --- PROFILE PICTURE --- */}
                    {data.personal.profilePic && (
                        <div className="mb-6 flex justify-center">
                            <img 
                                src={data.personal.profilePic} 
                                alt="Profile" 
                                className="w-32 h-32 rounded-full object-cover border-4 border-gray-700 shadow-lg"
                            />
                        </div>
                    )}

                    <header className="mb-8 text-center md:text-left">
                        <Title level={2} className="!text-white mb-2 text-2xl font-bold leading-tight">
                            {data.personal.name || 'Your Name'}
                        </Title>
                        <Title level={5} className="!text-indigo-400 font-medium mt-0 text-sm tracking-wide uppercase">
                            {data.personal.title || 'Professional Title'}
                        </Title>
                    </header>


                    <Divider className="my-6 bg-gray-700" />

                    <section className="mb-8">
                        <Title level={5} className="!text-white uppercase tracking-widest text-xs font-bold mb-4 border-b border-gray-700 pb-2">
                            Contact
                        </Title>
                        <Descriptions column={1} size="small" layout="horizontal" className="text-xs !text-gray-300">
                            {contactItems.map(item => (
                                <Descriptions.Item 
                                    key={item.key} 
                                    labelStyle={{ display: 'none' }} // Hide labels for cleaner look, icons imply meaning
                                    contentStyle={{ padding: '6px 0', fontSize: '13px', color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }} 
                                >
                                    <span className="text-indigo-400 text-base">{item.label}</span>
                                    {item.children}
                                </Descriptions.Item>
                            ))}
                        </Descriptions>
                    </section>

                </div>

                <div className={getSectionClass('skills')}> 
                    <EditButton section="skills" /> 
                    <section>
                        <Title level={5} className="!text-white uppercase tracking-widest text-xs font-bold mb-4 border-b border-gray-700 pb-2">
                            Skills
                        </Title>
                        {(data.skills && data.skills.trim()) ? (
                            <div className="flex flex-wrap gap-2">
                                {data.skills.split(',').map(skill => (
                                    <Tag key={skill.trim()} color="transparent" className="!text-gray-300 border border-gray-600 rounded-md m-0 px-2 py-1 text-xs">
                                        {skill.trim()}
                                    </Tag>
                                ))}
                            </div>
                        ) : (
                            <Text type="secondary" italic className="!text-gray-500">Add skills...</Text>
                        )}
                    </section>
                </div>
            </div>

            {/* Right Column (Main Content) */}
            <div className="col-span-3 p-8 pt-10 bg-[#111827]">
                
                <div className={`mb-10 ${getSectionClass('summary')}`}> 
                    <EditButton section="summary" /> 
                    <section>
                        <MainSectionTitle title="About Me" />
                        {data.summary ? (
                            <Paragraph className="text-base !text-gray-300 leading-7">
                                {data.summary}
                            </Paragraph>
                        ) : (
                            <Text type="secondary" italic className="!text-gray-500">Click the edit icon to add a summary.</Text>
                        )}
                    </section>
                </div>

                <div className={`mb-10 ${getSectionClass('experience')}`}> 
                    <EditButton section="experience" /> 
                    <section>
                        <MainSectionTitle title="Experience" />
                        {(data.experience && data.experience.length > 0) ? (
                            data.experience.map(item => <ModernDarkExperiencePreview key={item.id} item={item} />)
                        ) : (
                            <Text className="!text-gray-500" italic>Click the edit icon to add experience.</Text>
                        )}
                    </section>
                </div>

                <div className={getSectionClass('education')}> 
                    <EditButton section="education" /> 
                    <section>
                        <MainSectionTitle title="Education" />
                        {(data.education && data.education.length > 0) ? (
                            data.education.map(item => <ModernDarkEducationPreview key={item.id} item={item} />)
                        ) : (
                            <Text className="!text-gray-500" italic>Click the edit icon to add education.</Text>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ModernDarkDesign;