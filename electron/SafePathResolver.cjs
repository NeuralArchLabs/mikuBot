const path = require('path');

/**
 * SafePathResolver - Zero Leak Path Sandbox
 * Implements prefix-aware resolution and strict validation.
 */

let roots = {
    '@CORE': '',
    '@LIBRARY': '',
    '@TOOLS': '',
    '@WORKSPACE': ''
};

function init(config) {
    if (config['@CORE']) roots['@CORE'] = path.normalize(config['@CORE']);
    if (config['@LIBRARY']) roots['@LIBRARY'] = path.normalize(config['@LIBRARY']);
    if (config['@TOOLS']) roots['@TOOLS'] = path.normalize(config['@TOOLS']);
    if (config['@WORKSPACE']) roots['@WORKSPACE'] = path.normalize(config['@WORKSPACE']);
    
    console.log('[SafePathResolver] Initialized with roots:', roots);
}

function resolvePath(requestedPath) {
    if (!requestedPath) throw new Error('Path is required');

    // Default to workspace if no prefix is detected
    let prefix = '@WORKSPACE';
    let cleanPath = requestedPath;

    const prefixMatch = requestedPath.match(/^(@[A-Z]+)[\\/](.*)$/);
    if (prefixMatch) {
        prefix = prefixMatch[1];
        cleanPath = prefixMatch[2];
    } else if (requestedPath.startsWith('@')) {
        // Handle case where it might be just the prefix or malformed prefix
        const parts = requestedPath.split('/');
        prefix = parts[0];
        cleanPath = parts.slice(1).join('/');
    }

    const mappedRoot = roots[prefix];
    if (!mappedRoot) {
        // If it looks like a prefix but we don't know it, throw error
        if (prefix.startsWith('@')) {
            throw new Error(`SecurityError: Unknown or unauthorized prefix: ${prefix}`);
        }
        // If it doesn't look like a prefix, it might be a raw relative path.
        // For "Zero Leak", we should ideally force prefixes, but let's be pragmatic.
        // If no prefix, we treat it as workspace relative.
        return path.resolve(roots['@WORKSPACE'], requestedPath);
    }

    // Resolve and Normalize
    const resolvedPath = path.resolve(mappedRoot, cleanPath);
    const normalizedRoot = path.normalize(mappedRoot);

    // Strict Validation: Zero Leak check (Case-Insensitive for Windows compatibility)
    if (!resolvedPath.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
        throw new Error(`SecurityError: Access denied. Path "${resolvedPath}" is outside its authorized root "${normalizedRoot}".`);
    }

    return resolvedPath;
}

module.exports = {
    init,
    resolvePath,
    roots
};
