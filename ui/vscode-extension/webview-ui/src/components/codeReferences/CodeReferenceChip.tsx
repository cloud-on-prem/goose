import React from 'react';
import { CodeReference } from '../../types';
import './CodeReferenceChip.css';

interface CodeReferenceChipProps {
    codeReference: CodeReference;
    onRemove: (codeReference: CodeReference) => void;
    onClick?: (codeReference: CodeReference) => void;
}

const CodeReferenceChip: React.FC<CodeReferenceChipProps> = ({
    codeReference,
    onRemove,
    onClick
}) => {
    // Format the label to show filename and line numbers
    const getLabel = () => {
        const { fileName, startLine, endLine } = codeReference;
        const fileNameParts = fileName.split('/');
        const displayName = fileNameParts[fileNameParts.length - 1];

        if (startLine === endLine) {
            return `${displayName}:${startLine}`;
        }

        return `${displayName}:${startLine}-${endLine}`;
    };

    return (
        <div className="code-reference-chip">
            <button
                className="chip-button"
                onClick={() => {
                    if (onClick) {
                        onClick(codeReference);
                    }
                }}
            >
                <i className="codicon codicon-file-code"></i>
                <span className="chip-label">{getLabel()}</span>
            </button>
            <button
                className="remove-button"
                onClick={() => onRemove(codeReference)}
                title="Remove code reference"
            >
                <i className="codicon codicon-close"></i>
            </button>
        </div>
    );
};

export default CodeReferenceChip; 
