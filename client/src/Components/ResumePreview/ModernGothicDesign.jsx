import React from 'react';
import { Button, Typography } from 'antd';
import { 
    EditOutlined, 
    PhoneFilled, 
    MailFilled, 
    GlobalOutlined,
    EnvironmentFilled
} from '@ant-design/icons';

const { Title, Text, Paragraph, Link } = Typography;

const ModernGothicDesign = ({ data, onEditSection, editingSection }) => {
    
    // Helper used for section highlight
    const getSectionClass = (sectionName, isDark = false) => {
        const isActive = editingSection === sectionName;
        // High contrast highlight for both dark and light areas
        if (isDark) {
            return `relative transition-all duration-300 rounded-lg ${isActive ? 'ring-2 ring-white/70 bg-white/10 p-2 -m-2' : ''}`;
        }
        return `relative transition-all duration-300 rounded-lg ${isActive ? 'ring-2 ring-gray-600 bg-gray-200/50 p-2 -m-2' : ''}`;
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
        <div className="min-h-[11in] bg-[#e6e6e6] font-sans text-[#333] relative print:min-h-screen flex flex-col">
            
            {/* --- HEADER (DARK GREY) --- */}
            <div className={`bg-[#404040] min-h-[16rem] relative flex items-center justify-end px-12 py-12 print:py-8 ${getSectionClass('personal', true)}`}>
                <EditButton section="personal" className="top-4 right-4" />
                
                {/* Profile Circle (Overlapping) */}
                <div className="absolute left-12 top-12 z-20">
                    <div className="w-56 h-56 rounded-full border-4 border-white overflow-hidden bg-gray-300 shadow-xl">
                        {data.personal.profilePic ? (
                            <img src={data.personal.profilePic} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-200">No Photo</div>
                        )}
                    </div>
                </div>

                {/* Name & Title & Summary */}
                <div className="text-right text-white z-10 w-full pl-60">
                    <h1 className="text-5xl font-bold uppercase tracking-tighter mb-2 font-sans leading-none">
                        {data.personal.name || 'YOUR NAME'}
                    </h1>
                    <p className="text-lg uppercase tracking-[0.15em] text-gray-300 font-light mb-4">
                        {data.personal.title || 'Professional Title'}
                    </p>
                    
                    {/* Summary moved here to be part of the flow */}
                    <div className="text-gray-400 text-sm leading-relaxed text-justify ml-auto border-t border-gray-600 pt-4 mt-2">
                        {data.summary || 'Add a professional summary here...'}
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT COLUMNS --- */}
            {/* flex-1 ensures it fills remaining space */}
            <div className="flex flex-1">
                
                {/* --- LEFT COLUMN (DARK SIDEBAR) --- */}
                {/* FIX: Changed pt-32 to pt-24 to account for dynamic header overlap */}
                <div className="w-[35%] bg-[#333] text-gray-300 pt-24 px-8 pb-12 relative flex-shrink-0">
                    
                    {/* CONTACT */}
                    <div className={`group/section mb-12 ${getSectionClass('personal', true)}`}>
                        <EditButton section="personal" className="top-0 right-0" />
                        <h4 className="text-white uppercase tracking-widest font-bold border-b border-gray-500 pb-2 mb-6 text-sm">
                            Contact
                        </h4>
                        <div className="space-y-4 text-xs font-light tracking-wide">
                            <div className="flex items-start gap-3">
                                <PhoneFilled className="text-gray-500 mt-0.5" />
                                <div>
                                    <span className="block font-bold text-white mb-0.5">PHONE</span>
                                    {data.personal.phone}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MailFilled className="text-gray-500 mt-0.5" />
                                <div>
                                    <span className="block font-bold text-white mb-0.5">EMAIL</span>
                                    <span className="break-all">{data.personal.email}</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <EnvironmentFilled className="text-gray-500 mt-0.5" />
                                <div>
                                    <span className="block font-bold text-white mb-0.5">ADDRESS</span>
                                    {data.personal.city}
                                </div>
                            </div>
                            {data.personal.linkedin && (
                                <div className="flex items-start gap-3">
                                    <GlobalOutlined className="text-gray-500 mt-0.5" />
                                    <div>
                                        <span className="block font-bold text-white mb-0.5">WEBSITE</span>
                                        <Link href={`https://${data.personal.linkedin}`} target="_blank" className="text-gray-300 hover:text-white break-all">
                                            {data.personal.linkedin}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SKILLS */}
                    <div className={`group/section mb-12 ${getSectionClass('skills', true)}`}>
                        <EditButton section="skills" className="top-0 right-0" />
                        <h4 className="text-white uppercase tracking-widest font-bold border-b border-gray-500 pb-2 mb-6 text-sm">
                            Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {data.skills ? data.skills.split(',').map((skill, i) => (
                                <div 
                                    key={i} 
                                    className="border border-gray-600 px-3 py-1.5 text-xs text-gray-300 tracking-wide uppercase hover:border-white hover:text-white transition-colors cursor-default"
                                >
                                    {skill.trim()}
                                </div>
                            )) : <Text className="text-gray-500">Add skills...</Text>}
                        </div>
                    </div>

                </div>

                {/* --- RIGHT COLUMN (LIGHT CONTENT) --- */}
                <div className="w-[65%] pt-12 px-10 pb-12 bg-[#e6e6e6]">
                    
                    {/* EDUCATION */}
                    <div className={`group/section mb-12 ${getSectionClass('education', false)}`}>
                        <EditButton section="education" className="-left-8 top-0" />
                        
                        <div className="flex items-center mb-8">
                            <div className="h-[2px] bg-gray-800 w-12 mr-4"></div>
                            <h3 className="uppercase tracking-[0.2em] font-bold text-lg text-[#333] m-0">Education</h3>
                        </div>

                        <div className="relative border-l-2 border-gray-400 ml-3 pl-8 space-y-8 pb-2">
                            {(data.education || []).map(item => (
                                <div key={item.id} className="relative break-inside-avoid">
                                    {/* Timeline Dot */}
                                    <div className="absolute -left-[39px] top-1.5 w-3 h-3 rounded-full border-2 border-gray-800 bg-[#e6e6e6]"></div>
                                    
                                    <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">{item.institution}</h4>
                                    <div className="text-xs text-gray-600 mb-1 font-medium">{item.degree}</div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-300 inline-block pb-0.5">
                                        {item.startYear} - {item.endYear}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* EXPERIENCE */}
                    <div className={`group/section ${getSectionClass('experience', false)}`}>
                        <EditButton section="experience" className="-left-8 top-0" />
                        
                        <div className="flex items-center mb-8">
                            <div className="h-[2px] bg-gray-800 w-12 mr-4"></div>
                            <h3 className="uppercase tracking-[0.2em] font-bold text-lg text-[#333] m-0">Experience</h3>
                        </div>

                        <div className="relative border-l-2 border-gray-400 ml-3 pl-8 space-y-10">
                            {(data.experience || []).map(item => (
                                <div key={item.id} className="relative break-inside-avoid">
                                    <div className="absolute -left-[39px] top-1.5 w-3 h-3 rounded-full border-2 border-gray-800 bg-[#e6e6e6]"></div>
                                    
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className="font-bold text-gray-900 text-base uppercase">{item.company}</h4>
                                    </div>
                                    
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span>{item.title}</span>
                                        <span className="h-1 w-1 bg-gray-400 rounded-full"></span>
                                        <span>{item.startDate} - {item.endDate}</span>
                                    </div>
                                    
                                    <ul className="list-none ml-0 space-y-2 text-gray-700 text-xs leading-relaxed text-justify">
                                        {item.description && item.description.split('\n').map((line, i) => line && (
                                            <li key={i} className="relative pl-3">
                                                <span className="absolute left-0 top-1.5 w-1 h-1 bg-gray-400 rounded-full"></span>
                                                {line.replace(/^[•-]\s*/, '')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ModernGothicDesign;