import React from 'react';
import { Button, Typography, Row, Col, Divider } from 'antd';
import { 
    EditOutlined, 
    PhoneFilled, 
    MailFilled, 
    EnvironmentFilled,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const MinimalistBeigeDesign = ({ data, onEditSection }) => {
    
    const EditButton = ({ section, className }) => (
        <Button
            type="primary"
            shape="circle"
            icon={<EditOutlined />}
            onClick={() => onEditSection(section)}
            className={`print:hidden absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 ${className}`}
        />
    );

    const SectionHeader = ({ title }) => (
        <h3 className="uppercase tracking-widest font-bold text-lg mb-6 text-[#2d2a26]">
            {title}
        </h3>
    );

    return (
        <div className="min-h-[11in] bg-[#fffbf2] font-sans text-[#4a4a4a] relative print:min-h-screen px-12 py-16">
            
            {/* --- HEADER --- */}
            <div className="flex items-start gap-10 mb-12 relative">
                <EditButton section="personal" className="-left-4 top-0" />
                
                {/* Profile Picture */}
                <div className="shrink-0">
                    <div className="w-52 h-52 rounded-full translate-x-[-30%] overflow-hidden border-4 border-white shadow-sm bg-gray-200">
                        {data.personal.profilePic ? (
                            <img src={data.personal.profilePic} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 text-xs">No Photo</div>
                        )}
                    </div>
                </div>

                {/* Name & Contact */}
                <div className="flex-grow pt-2">
                    <h1 className="text-4xl font-bold text-[#1a1a1a] mb-2 font-serif tracking-tight">
                        {data.personal.name || 'YOUR NAME'}
                    </h1>
                    <p className="text-lg text-[#555] font-medium italic mb-6">
                        {data.personal.title || 'Professional Title'}
                    </p>
                    
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#666]">
                        <div className="flex items-center gap-2">
                            <PhoneFilled className="text-[#8c7355]" /> {data.personal.phone}
                        </div>
                        <div className="flex items-center gap-2">
                            <MailFilled className="text-[#8c7355]" /> {data.personal.email}
                        </div>
                        <div className="flex items-center gap-2">
                            <EnvironmentFilled className="text-[#8c7355]" /> {data.personal.city}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-[#e6e2d8] mb-10"></div>

            <Row gutter={48}>
                {/* --- LEFT COLUMN --- */}
                <Col span={10}>
                    
                    {/* SKILLS */}
                    <div className="relative group/section mb-12">
                        <EditButton section="skills" className="-left-8 top-0" />
                        <SectionHeader title="SKILLSET" />
                        
                        <div className="space-y-4">
                            {data.skills ? data.skills.split(',').map((skill, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8c7355] shrink-0"></div>
                                    <div>
                                        <div className="font-bold text-[#2d2a26]">{skill.trim()}</div>
                                        <div className="text-xs text-[#888] leading-tight mt-0.5">Experienced & Proficient</div>
                                    </div>
                                </div>
                            )) : <Text type="secondary">Add skills...</Text>}
                        </div>
                    </div>

                    {/* EDUCATION */}
                    <div className="relative group/section mb-12">
                        <EditButton section="education" className="-left-8 top-0" />
                        <SectionHeader title="EDUCATION" />
                        
                        <div className="space-y-6">
                            {(data.education || []).map(item => (
                                <div key={item.id}>
                                    <div className="font-bold text-[#2d2a26] text-base">{item.institution}</div>
                                    <div className="text-sm text-[#666] italic mb-1">{item.degree}</div>
                                    <div className="text-xs font-bold text-[#8c7355]">{item.startYear} - {item.endYear}</div>
                                    <p className="text-xs text-[#888] mt-1 leading-relaxed">
                                        Academic excellence in relevant coursework.
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                </Col>

                {/* --- RIGHT COLUMN --- */}
                <Col span={14}>
                    
                    {/* PROFILE (SUMMARY) */}
                    <div className="relative group/section mb-12">
                        <EditButton section="summary" className="-right-8 top-0" />
                        <SectionHeader title="PROFILE" />
                        <Paragraph className="text-[#555] leading-7 text-justify text-sm">
                            {data.summary || 'Add a professional summary to introduce yourself...'}
                        </Paragraph>
                    </div>

                    {/* EXPERIENCE */}
                    <div className="relative group/section">
                        <EditButton section="experience" className="-right-8 top-0" />
                        <SectionHeader title="EXPERIENCE" />
                        
                        <div className="space-y-8">
                            {(data.experience || []).map(item => (
                                <div key={item.id}>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className="font-bold text-[#2d2a26] text-base m-0">{item.title}</h4>
                                        <span className="text-xs font-bold text-[#8c7355]">{item.startDate} - {item.endDate}</span>
                                    </div>
                                    <div className="text-sm text-[#666] italic mb-3">{item.company}</div>
                                    
                                    <ul className="list-none ml-0 space-y-2 text-[#555] text-sm leading-relaxed">
                                        {item.description && item.description.split('\n').map((line, i) => line && (
                                            <li key={i}>{line.replace(/^[•-]\s*/, '')}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>

                </Col>
            </Row>

        </div>
    );
};

export default MinimalistBeigeDesign;