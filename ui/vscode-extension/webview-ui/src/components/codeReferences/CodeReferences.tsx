import React from 'react';
import { CodeReference } from '../../types';
import CodeReferenceChip from './CodeReferenceChip';

interface CodeReferencesProps {
    codeReferences: CodeReference[];
    onRemoveReference: (id: string) => void;
}

export const CodeReferences: React.FC<CodeReferencesProps> = ({
    codeReferences,
    onRemoveReference
}) => {
    if (codeReferences.length === 0) {
        return null;
    }

    return (
        <div className="code-references">
            {codeReferences.map((ref) => (
                <CodeReferenceChip
                    key={ref.id}
                    codeReference={ref}
                    onRemove={() => onRemoveReference(ref.id)}
                />
            ))}
        </div>
    );
}; 
