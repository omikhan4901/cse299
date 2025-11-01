import React from 'react';

// --- Resume Sub-Components & Helpers (Dark Mode) ---

const DarkBulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        <ul className="list-disc list-inside space-y-1 mt-2 text-gray-300 ml-5">
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
                <h4 className="text-lg font-semibold text-white">{item.title || 'Job Title'}</h4>
                <p className="text-md italic text-gray-400">{item.company || 'Company Name'}</p>
            </div>
            <span className="text-sm text-gray-500 flex-shrink-0 ml-4">{item.startDate} - {item.endDate}</span>
        </div>
        <DarkBulletPoints text={item.description} />
    </div>
);

const DarkEducationPreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <h4 className="text-lg font-semibold text-white">{item.degree || 'Degree'}</h4>
                <p className="text-md italic text-gray-400">{item.institution || 'Institution Name'}</p>
            </div>
            <span className="text-sm text-gray-500 flex-shrink-0 ml-4">{item.startYear} - {item.endYear}</span>
        </div>
    </div>
);

const ClassicDarkDesign = ({ data }) => {
    const primaryColor = 'text-indigo-400';
    const borderColor = 'border-indigo-600';

    return (
        <> 
            {/* Header / Personal Info */}
            <header className="text-center pb-3 border-b-2 border-indigo-600 mb-4">
                <h1 className="text-3xl font-extrabold text-white mb-1">{data.personal.name || 'Your Name'}</h1>
                <p className="text-md font-medium text-indigo-400 mb-2">{data.personal.title || 'Professional Title'}</p>
                <div className="text-sm text-gray-400 flex justify-center flex-wrap gap-x-4">
                    <span>{data.personal.phone}</span> |
                    <span className={primaryColor}>{data.personal.email}</span> |
                    <span>{data.personal.city}</span> |
                    <span className={primaryColor}>{data.personal.linkedin}</span>
                </div>
            </header>

            {/* Summary */}
            {data.summary && (
                <section className="mb-4">
                    <h2 className={`text-lg font-bold uppercase tracking-wider ${primaryColor} border-b border-gray-700 pb-1 mb-2`}>Summary</h2>
                    <p className="text-sm text-gray-300">{data.summary}</p>
                </section>
            )}

            {/* Experience */}
            {data.experience.length > 0 && (
                <section className="mb-4">
                    <h2 className={`text-lg font-bold uppercase tracking-wider ${primaryColor} border-b border-gray-700 pb-1 mb-2`}>Experience</h2>
                    {data.experience.map(item => <DarkExperiencePreview key={item.id} item={item} />)}
                </section>
            )}

            {/* Education */}
            {data.education.length > 0 && (
                <section className="mb-4">
                    <h2 className={`text-lg font-bold uppercase tracking-wider ${primaryColor} border-b border-gray-700 pb-1 mb-2`}>Education</h2>
                    {data.education.map(item => <DarkEducationPreview key={item.id} item={item} />)}
                </section>
            )}

            {/* Skills */}
            {data.skills && (
                <section>
                    <h2 className={`text-lg font-bold uppercase tracking-wider ${primaryColor} border-b border-gray-700 pb-1 mb-2`}>Skills</h2>
                    <p className="text-sm text-gray-300">{data.skills}</p>
                </section>
            )}
        </>
    );
};

export default ClassicDarkDesign;
