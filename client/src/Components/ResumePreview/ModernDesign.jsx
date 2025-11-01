// client/src/Components/ResumePreview/ModernDesign.jsx (New File)
import React from 'react';

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

// Component for a section title in the main column
const MainSectionTitle = ({ title }) => (
    <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800 dark:text-white border-b-2 border-indigo-200 dark:border-indigo-700 pb-1 mb-3">
        {title}
    </h2>
);

const ModernExperiencePreview = ({ item }) => (
    <div className="mb-5">
        <div className="flex justify-between items-start">
            <h4 className="text-md font-bold text-indigo-700 dark:text-indigo-400">{item.title || 'Job Title'} @ {item.company || 'Company Name'}</h4>
            <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0 ml-4 italic">{item.startDate} - {item.endDate}</span>
        </div>
        <BulletPoints text={item.description} />
    </div>
);

const ModernEducationPreview = ({ item }) => (
    <div className="mb-5">
        <div className="flex justify-between items-start">
            <h4 className="text-md font-bold text-gray-800 dark:text-white">{item.degree || 'Degree'}</h4>
            <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0 ml-4 italic">{item.startYear} - {item.endYear}</span>
        </div>
        <p className="text-sm italic text-gray-600 dark:text-gray-400">{item.institution || 'Institution Name'}</p>
    </div>
);


const ModernDesign = ({ data }) => {
    return (
        <div className="grid grid-cols-4 gap-6 min-h-[10in]">
            {/* Left Column (1/4 width) - Contact & Skills */}
            <div className="col-span-1 bg-indigo-50 dark:bg-gray-700 p-4 pt-6 border-r border-indigo-200 dark:border-indigo-600">
                
                {/* Personal Info Title */}
                <header className="mb-6">
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">{data.personal.name || 'Your Name'}</h1>
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{data.personal.title || 'Professional Title'}</p>
                </header>

                {/* Contact Info */}
                <section className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-400 border-b border-indigo-200 pb-1 mb-2">Contact</h3>
                    <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                        <p><strong>Email:</strong> {data.personal.email}</p>
                        <p><strong>Phone:</strong> {data.personal.phone}</p>
                        <p><strong>Location:</strong> {data.personal.city}</p>
                        <p><strong>LinkedIn:</strong> <a href={`https://${data.personal.linkedin}`} target="_blank" className="text-indigo-600 dark:text-indigo-300 break-words">{data.personal.linkedin}</a></p>
                    </div>
                </section>

                {/* Skills */}
                {data.skills && (
                    <section className="mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-400 border-b border-indigo-200 pb-1 mb-2">Skills</h3>
                        <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{data.skills.split(',').map(s => s.trim()).join(' • ')}</p>
                    </section>
                )}
            </div>

            {/* Right Column (3/4 width) - Content */}
            <div className="col-span-3 p-4 pt-6">
                
                {/* Summary */}
                {data.summary && (
                    <section className="mb-6">
                        <MainSectionTitle title="Summary" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">{data.summary}</p>
                    </section>
                )}

                {/* Experience */}
                {data.experience.length > 0 && (
                    <section className="mb-6">
                        <MainSectionTitle title="Experience" />
                        {data.experience.map(item => <ModernExperiencePreview key={item.id} item={item} />)}
                    </section>
                )}

                {/* Education */}
                {data.education.length > 0 && (
                    <section className="mb-6">
                        <MainSectionTitle title="Education" />
                        {data.education.map(item => <ModernEducationPreview key={item.id} item={item} />)}
                    </section>
                )}
            </div>
        </div>
    );
};

export default ModernDesign;