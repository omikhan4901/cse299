import React from 'react';
import { Input, Button, Card, Icons } from "../random";

// This component is now extracted from MainBuilder.jsx
// It receives all its logic as props, making it a "dumb" component.
const DynamicListEditor = ({ 
    title, 
    sectionName, 
    items, 
    onAdd, 
    onUpdate, 
    onDelete, 
    onRefine, 
    refiningId 
}) => {
    
    // A helper to determine which fields to show based on section
    const renderFields = (item) => {
        if (sectionName === 'experience') {
            return (
                <>
                    <Input label="Title" name="title" value={item.title} onChange={(e) => onUpdate(sectionName, item.id, 'title', e.target.value)} />
                    <Input label="Company" name="company" value={item.company} onChange={(e) => onUpdate(sectionName, item.id, 'company', e.target.value)} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Start Date (YYYY-MM)" name="startDate" value={item.startDate} onChange={(e) => onUpdate(sectionName, item.id, 'startDate', e.target.value)} />
                        <Input label="End Date (YYYY-MM/Present)" name="endDate" value={item.endDate} onChange={(e) => onUpdate(sectionName, item.id, 'endDate', e.target.value)} />
                    </div>
                    <Input 
                        type="textarea" 
                        label="Description (Bullet Points)" 
                        name="description" 
                        value={item.description} 
                        onChange={(e) => onUpdate(sectionName, item.id, 'description', e.target.value)} 
                    />
                </>
            );
        }
        
        if (sectionName === 'education') {
            return (
                <>
                    <Input label="Institution" name="institution" value={item.institution} onChange={(e) => onUpdate(sectionName, item.id, 'institution', e.target.value)} />
                    <Input label="Degree / Field of Study" name="degree" value={item.degree} onChange={(e) => onUpdate(sectionName, item.id, 'degree', e.target.value)} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Start Year" name="startYear" value={item.startYear} onChange={(e) => onUpdate(sectionName, item.id, 'startYear', e.target.value)} />
                        <Input label="End Year" name="endYear" value={item.endYear} onChange={(e) => onUpdate(sectionName, item.id, 'endYear', e.target.value)} />
                    </div>
                </>
            );
        }
        return null;
    };

    return (
        // Note: We removed the outer <Card> shell so it can be used for other sections
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex justify-between items-center">
                {title}
                <Button variant="secondary" onClick={onAdd} className="ml-4">
                    <Icons.Plus className="w-4 h-4 mr-2" /> Add Entry
                </Button>
            </h3>
            <div className="space-y-4">
                {items.map((item) => (
                    <div key={item.id} className="p-4 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-indigo-50 dark:bg-gray-700 shadow-sm relative">
                        {/* Action Buttons */}
                        <div className="absolute top-2 right-2 flex space-x-2">
                            {/* Only show AI refine button for experience */}
                            {onRefine && (
                                <Button
                                    variant="ai"
                                    onClick={() => onRefine(item.id, item.description)}
                                    loading={refiningId === item.id}
                                    disabled={refiningId && refiningId !== item.id}
                                    className="p-1 h-8 w-8 text-xs"
                                >
                                    <Icons.Zap className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="danger"
                                onClick={() => onDelete(item.id)}
                                className="p-1 h-8 w-8 text-xs"
                                disabled={refiningId}
                            >
                                <Icons.X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Render the correct form fields */}
                        {renderFields(item)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DynamicListEditor;
