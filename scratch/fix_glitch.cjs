const fs = require('fs');
const path = 'd:/Armando/Desktop/workSpace/ProyectosDev/mikuCentralv1.0/src/components/features/ChatArea.tsx';
let content = fs.readFileSync(path, 'utf8');

// Match the specific pattern of Layer 2
const oldText = /Layer 2: Glass Backdrop --- \*\/\s+<div className={`absolute inset-0 z-0 rounded-\[inherit\] pointer-events-none backdrop-blur-md \$\{([\s\S]*?)\}`\) \}\s+\/>/m;

const replacement = `Layer 2: Glass Backdrop (Clipped Shield) --- */
                                         <div className="absolute inset-0 z-0 rounded-[inherit] overflow-hidden pointer-events-none">
                                            <div className={\`absolute inset-0 backdrop-blur-md \${$1}\` } />
                                         </div>`;

if (content.includes('backdrop-blur-md ${')) {
    // String based replace to be safe from regex pitfalls
    const targetLine = '                                         <div className={`absolute inset-0 z-0 rounded-[inherit] pointer-events-none backdrop-blur-md ${';
    const closingLine = '                                         }`} />';
    
    const startIndex = content.indexOf(targetLine);
    if (startIndex !== -1) {
        console.log('Found start at', startIndex);
        const endIndex = content.indexOf(closingLine, startIndex);
        if (endIndex !== -1) {
            console.log('Found end at', endIndex);
            const totalEndIndex = endIndex + closingLine.length;
            const originalBlock = content.substring(startIndex, totalEndIndex);
            
            // Extract the inside content (the conditional logic)
            const insideContent = originalBlock
                .substring(targetLine.length, originalBlock.length - closingLine.length);
            
            const newBlock = `                                         <div className="absolute inset-0 z-0 rounded-[inherit] overflow-hidden pointer-events-none">
                                            <div className={\`absolute inset-0 backdrop-blur-md \${${insideContent}}\`} />
                                         </div>`;
            
            content = content.substring(0, startIndex) + newBlock + content.substring(totalEndIndex);
            fs.writeFileSync(path, content);
            console.log('Successfully replaced block');
        } else {
            console.log('Could not find closing line');
        }
    } else {
        console.log('Could not find start line');
    }
} else {
    console.log('Could not find identifying string');
}
