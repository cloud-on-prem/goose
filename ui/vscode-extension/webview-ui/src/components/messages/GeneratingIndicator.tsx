import React, { useState } from 'react';
import './GeneratingIndicator.css';

interface GeneratingIndicatorProps {
    onStop: () => void;
    intermediateContent: string | null;
    errorMessage?: string | null;
}

const GeneratingIndicator: React.FC<GeneratingIndicatorProps> = ({
    onStop,
    intermediateContent = null,
    errorMessage = null
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className="generating-container">
            {intermediateContent && (
                <div className="thinking-content">
                    <div className="thinking-header">
                        <span>Thinking</span>
                        <button
                            className="collapse-button"
                            onClick={toggleCollapse}
                            title={isCollapsed ? "Expand thinking" : "Collapse thinking"}
                        >
                            {isCollapsed ? "+" : "-"}
                        </button>
                    </div>
                    {!isCollapsed && (
                        <div className="intermediate-text">
                            <pre>{intermediateContent}</pre>
                        </div>
                    )}
                </div>
            )}
            <div className="generating-indicator">
                {errorMessage ? (
                    <>
                        <span>{errorMessage}</span>
                        <button
                            className="restart-server-button"
                            onClick={onStop}
                            title="Restart server"
                        >
                            Restart Server
                        </button>
                    </>
                ) : (
                    <>
                        <div className="dot-pulse"></div>
                        <span>Generating...</span>
                        <button
                            className="stop-generation-button"
                            onClick={onStop}
                            title="Stop generation"
                        >
                            Stop
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default GeneratingIndicator; 
