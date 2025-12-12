import React from 'react';
import { Button, Typography, Divider, Tag } from 'antd';
import { 
    EditOutlined, 
    MailOutlined, 
    PhoneOutlined, 
    LinkedinOutlined, 
    HomeOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph, Link } = Typography;

const ModernDesign = ({ data, onEditSection, editingSection }) => {
    
    // Helper for active section styling (Teal themed)
    const getSectionClass = (sectionName) => {
        const isActive = editingSection === sectionName;
        return `relative transition-all duration-300 rounded-lg ${isActive ? 'ring-2 ring-teal-400 bg-teal-50/20 p-2 -m-2' : ''}`;
    };

    const EditButton = ({ section, className }) => (
        <Button
            type="primary"
            shape="circle"
            icon={<EditOutlined />}
            onClick={() => onEditSection(section)}
            className={`print:hidden absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 ${className}`}
        />
    );

    return (
        <div className="min-h-[11in] bg-white font-sans flex print:min-h-screen relative text-slate-800">
            
            {/* --- LEFT SIDEBAR (Dark Blue) --- */}
            <div className="w-[32%] bg-[#1e293b] text-slate-300 p-8 flex flex-col relative print:h-auto min-h-full">
                
                {/* Profile Picture */}
                <div className={`${getSectionClass('personal')} mb-8 text-center group/section`}>
                    <EditButton section="personal" className="top-0 right-0" />
                    <div className="w-40 h-40 mx-auto rounded-full border-4 border-slate-500 overflow-hidden mb-6 bg-slate-700">
                        {data.personal.profilePic ? (
                            <img src={data.personal.profilePic} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">No Photo</div>
                        )}
                    </div>
                    
                    <h1 className="text-3xl font-bold text-white uppercase leading-tight tracking-wide mb-2">
                        {data.personal.name}
                    </h1>
                    <p className="text-slate-400 uppercase tracking-widest text-sm font-medium">
                        {data.personal.title}
                    </p>
                </div>

                {/* Contact Info */}
                <div className={`${getSectionClass('personal')} mb-10 group/section`}>
                    <EditButton section="personal" className="top-0 right-0" />
                    <h3 className="text-slate-400 uppercase tracking-widest text-sm font-bold border-b border-slate-600 pb-2 mb-4">
                        Contact
                    </h3>
                    <div className="space-y-4 text-sm font-light">
                        <div className="flex items-start gap-3">
                            <MailOutlined className="mt-1 text-slate-400" />
                            <span className="break-all">{data.personal.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <PhoneOutlined className="text-slate-400" />
                            <span>{data.personal.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <HomeOutlined className="text-slate-400" />
                            <span>{data.personal.city}</span>
                        </div>
                        {data.personal.linkedin && (
                            <div className="flex items-start gap-3">
                                <LinkedinOutlined className="mt-1 text-slate-400" />
                                <Link href={`https://${data.personal.linkedin}`} target="_blank" className="text-slate-300 hover:text-white break-all">
                                    {data.personal.linkedin}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Skills */}
                <div className={`${getSectionClass('skills')} group/section`}>
                    <EditButton section="skills" className="top-0 right-0" />
                    <h3 className="text-slate-400 uppercase tracking-widest text-sm font-bold border-b border-slate-600 pb-2 mb-4">
                        Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {data.skills ? data.skills.split(',').map((skill, i) => (
                            <Tag key={i} className="bg-slate-700 border-none text-slate-200 px-3 py-1 mb-1 rounded-full text-xs">
                                {skill.trim()}
                            </Tag>
                        )) : <span className="text-slate-500 italic">Add skills...</span>}
                    </div>
                </div>
            </div>

            {/* --- RIGHT CONTENT (White) --- */}
            <div className="w-[68%] p-12 bg-white">
                
                {/* About Me */}
                <div className={`${getSectionClass('summary')} mb-12 group/section`}>
                    <EditButton section="summary" className="-left-4 top-0" />
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide border-b-2 border-indigo-600 pb-2 mb-4 inline-block pr-12">
                        About Me
                    </h2>
                    <div className="w-full border-b border-slate-200 mb-4 -mt-[11px] z-[-1]"></div>
                    
                    <Paragraph className="text-slate-600 leading-relaxed text-justify text-[15px]">
                        {data.summary || 'Add a professional summary here...'}
                    </Paragraph>
                </div>

                {/* Experience */}
                <div className={`${getSectionClass('experience')} mb-12 group/section`}>
                    <EditButton section="experience" className="-left-4 top-0" />
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide border-b-2 border-indigo-600 pb-2 mb-6 inline-block pr-12">
                        Experience
                    </h2>
                    <div className="w-full border-b border-slate-200 mb-8 -mt-[25px] z-[-1]"></div>

                    <div className="space-y-8">
                        {(data.experience || []).map(item => (
                            <div key={item.id} className="relative pl-6 border-l-2 border-indigo-100 break-inside-avoid">
                                {/* Timeline Dot */}
                                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-600 bg-white"></div>
                                
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="text-lg font-bold text-slate-800 m-0">
                                        {item.title} <span className="font-normal text-slate-500 text-base">@ {item.company}</span>
                                    </h3>
                                    <span className="text-xs font-bold text-slate-400 italic">
                                        {item.startDate} - {item.endDate}
                                    </span>
                                </div>
                                
                                <ul className="list-disc list-outside ml-4 mt-2 text-slate-600 text-sm space-y-1 leading-relaxed">
                                    {item.description && item.description.split('\n').map((line, i) => line && (
                                        <li key={i}>{line.replace(/^[•-]\s*/, '')}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Education */}
                <div className={`${getSectionClass('education')} group/section`}>
                    <EditButton section="education" className="-left-4 top-0" />
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide border-b-2 border-indigo-600 pb-2 mb-6 inline-block pr-12">
                        Education
                    </h2>
                    <div className="w-full border-b border-slate-200 mb-8 -mt-[25px] z-[-1]"></div>

                    <div className="space-y-6">
                        {(data.education || []).map(item => (
                            <div key={item.id} className="flex justify-between items-start break-inside-avoid">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 m-0">{item.institution}</h3>
                                    <div className="text-indigo-600 font-medium">{item.degree}</div>
                                </div>
                                <span className="text-sm font-bold text-slate-400 italic">
                                    {item.startYear} - {item.endYear}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ModernDesign;