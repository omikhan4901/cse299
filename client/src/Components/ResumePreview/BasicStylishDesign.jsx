import React from 'react';
import { Button, Typography, Row, Col } from 'antd';
import { 
    EditOutlined, 
    PhoneFilled, 
    MailFilled, 
    GlobalOutlined,
    HomeFilled
} from '@ant-design/icons';

const { Title, Text, Paragraph, Link } = Typography;

const BasicStylishDesign = ({ data, onEditSection }) => {
    
    const EditButton = ({ section, className }) => (
        <Button
            type="primary"
            shape="circle"
            icon={<EditOutlined />}
            onClick={() => onEditSection(section)}
            className={`print:hidden absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 ${className}`}
        />
    );

    // The grey block header style from the image
    const SectionHeader = ({ title }) => (
        <div className="mb-6 mt-8">
            <span className="bg-[#e2e8f0] text-slate-800 px-6 py-2 uppercase font-bold tracking-wider text-sm inline-block">
                {title}
            </span>
            <div className="h-[1px] bg-slate-300 w-full mt-0"></div>
        </div>
    );

    return (
        <div className="min-h-[11in] bg-white font-sans text-slate-800 relative print:min-h-screen">
            
            {/* --- HEADER --- */}
            <div className="pt-16 pb-8 px-12 relative text-center md:text-left">
                <EditButton section="personal" className="top-4 right-4" />
                
                {/* Name & Title */}
                <Title level={1} className="!text-slate-900 uppercase tracking-widest !mb-0" style={{ fontSize: '3rem', fontWeight: 800 }}>
                    {data.personal.name || 'YOUR NAME'}
                </Title>
                <Text className="text-xl text-slate-600 block mt-2 font-light tracking-wide">
                    {data.personal.title || 'Professional Title'}
                </Text>
            </div>

            {/* --- CONTACT STRIP --- */}
            <div className="bg-[#e2e8f0] py-3 px-12 flex flex-wrap justify-between items-center text-sm text-slate-700 relative">
                <div className="flex items-center gap-2">
                    <PhoneFilled /> {data.personal.phone}
                </div>
                <div className="flex items-center gap-2">
                    <HomeFilled /> {data.personal.city}
                </div>
                <div className="flex items-center gap-2">
                    <GlobalOutlined /> 
                    <Link href={`https://${data.personal.linkedin}`} target="_blank" className="text-slate-700 hover:text-slate-900">
                        {data.personal.linkedin}
                    </Link>
                </div>
                <div className="flex items-center gap-2">
                    <MailFilled /> {data.personal.email}
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="px-12 py-8">
                
                {/* 1. ABOUT ME */}
                <div className="relative group/section">
                    <EditButton section="summary" className="-left-12 top-2" />
                    <SectionHeader title="About Me" />
                    <Paragraph className="text-slate-600 leading-relaxed text-justify">
                        {data.summary || 'Add a professional summary to introduce yourself...'}
                    </Paragraph>
                </div>

                {/* 2. EDUCATION */}
                <div className="relative group/section">
                    <EditButton section="education" className="-left-12 top-2" />
                    <SectionHeader title="Education" />
                    
                    <div className="space-y-6">
                        {(data.education || []).map(item => (
                            <div key={item.id} className="border-b border-slate-100 pb-4 last:border-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h4 className="font-bold text-slate-900 uppercase text-base m-0 tracking-wide">
                                        {item.institution}
                                    </h4>
                                    <span className="text-sm font-bold text-slate-500">
                                        {item.startYear} - {item.endYear}
                                    </span>
                                </div>
                                <div className="text-slate-600 italic">{item.degree}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. SKILLS */}
                <div className="relative group/section">
                    <EditButton section="skills" className="-left-12 top-2" />
                    <SectionHeader title="Skills" />
                    
                    {/* Grid Layout for Skills like the image */}
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                        {data.skills ? data.skills.split(',').map((skill, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
                                <span className="text-slate-700 font-medium">{skill.trim()}</span>
                            </div>
                        )) : <Text type="secondary">Add skills...</Text>}
                    </div>
                </div>

                {/* 4. WORK EXPERIENCE */}
                <div className="relative group/section">
                    <EditButton section="experience" className="-left-12 top-2" />
                    <SectionHeader title="Work Experience" />
                    
                    <div className="space-y-8">
                        {(data.experience || []).map(item => (
                            <div key={item.id}>
                                <div className="flex justify-between items-end mb-2">
                                    <h4 className="font-bold text-slate-900 text-lg m-0">
                                        {item.company} <span className="font-normal text-slate-500 text-base">– {item.title}</span>
                                    </h4>
                                    <span className="text-sm font-bold text-slate-900 uppercase">
                                        {item.startDate} - {item.endDate}
                                    </span>
                                </div>
                                
                                <ul className="list-disc list-inside space-y-1 text-slate-600 ml-2">
                                    {item.description && item.description.split('\n').map((line, i) => line && (
                                        <li key={i}>{line.replace(/^[•-]\s*/, '')}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BasicStylishDesign;