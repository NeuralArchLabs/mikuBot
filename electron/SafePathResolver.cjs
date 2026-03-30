const path = require('path');

/**
 * SafePathResolver - Zero Leak Path Sandbox
 * Implements prefix-aware resolution and strict validation.
 */

let roots = {
    '@CORE': '',
    '@LIBRARY': '',
    '@TOOLS': '',
    '@WORKSPACE': '',
    '@ROOT': ''
};

function init(config) {
    if (config['@CORE']) roots['@CORE'] = path.normalize(config['@CORE']);
    if (config['@LIBRARY']) roots['@LIBRARY'] = path.normalize(config['@LIBRARY']);
    if (config['@TOOLS']) roots['@TOOLS'] = path.normalize(config['@TOOLS']);
    if (config['@WORKSPACE']) roots['@WORKSPACE'] = path.normalize(config['@WORKSPACE']);
    if (config['@ROOT']) roots['@ROOT'] = path.normalize(config['@ROOT']);
    
    console.log('[SafePathResolver] Initialized with roots:', roots);
}

function resolvePath(requestedPath) {
    if (!requestedPath) throw new Error('Path is required');

    // NO default prefix anymore for maximum security.
    let prefix = null;
    let cleanPath = requestedPath;

    // Detect Prefix
    const prefixMatch = requestedPath.match(/^(@[A-Z]+)[\\/](.*)$/);
    if (prefixMatch) {
        prefix = prefixMatch[1];
        cleanPath = prefixMatch[2];
    } else if (requestedPath.startsWith('@')) {
        const parts = requestedPath.split(/[\\/]/);
        prefix = parts[0];
        cleanPath = parts.slice(1).join('/');
    } else if (path.isAbsolute(requestedPath)) {
        // For absolute paths: determine which root they belong to.
        const normRequested = path.normalize(requestedPath).toLowerCase();
        let foundPrefix = null;
        for (const [pref, root] of Object.entries(roots)) {
            if (!root) continue;
            const normRoot = path.normalize(root).toLowerCase();
            // Prefix check should be strict: root path or subpath
            if (normRequested === normRoot || normRequested.startsWith(normRoot + path.sep)) {
                foundPrefix = pref;
                break;
            }
        }
        if (!foundPrefix) {
            throw new Error(`SecurityError: Access denied. Absolute path "${requestedPath}" is outside all authorized roots.`);
        }
        // If found, treat it as validated since it belongs to a root
        return path.normalize(requestedPath);
    }

    const mappedRoot = roots[prefix];
    if (!mappedRoot) {
        throw new Error(`SecurityError: ${prefix ? 'Unknown or unauthorized prefix: ' + prefix : 'No path prefix provided (@ROOT, @WORKSPACE, etc.) and path is not absolute.'}`);
    }

    // Security: Prevent cleanPath from starting with slashes to avoid drive root resolution on Windows
    const finalCleanPath = cleanPath.replace(/^[\\\/]+/, '');
    
    // Resolve and Normalize
    const resolvedPath = path.resolve(mappedRoot, finalCleanPath);
    const normalizedRoot = path.normalize(mappedRoot);

    // Final "Zero Leak" Check: Every single path MUST start with its prefix root
    const lowerResolved = resolvedPath.toLowerCase();
    const lowerRoot = normalizedRoot.toLowerCase();
    
    const isIllegal = lowerResolved !== lowerRoot && !lowerResolved.startsWith(lowerRoot + path.sep);

    if (isIllegal) {
        throw new Error(`SecurityError: Access denied. Path "${resolvedPath}" is outside its authorized root "${normalizedRoot}".`);
    }

    return resolvedPath;
}

module.exports = {
    init,
    resolvePath,
    roots
};
