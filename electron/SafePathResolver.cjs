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

/**
 * Normalizes a path and ensures it doesn't have a trailing separator 
 * UNLESS it's a drive root (e.g., C:\).
 */
function normalizeRoot(p) {
    if (!p) return '';
    let normalized = path.normalize(p);
    // If it's not a drive root (like D:\) and ends with a separator, remove it
    if (normalized.length > 3 && normalized.endsWith(path.sep)) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

/**
 * Checks if 'child' is the same as or inside 'parent'
 */
function isWithin(parent, child) {
    if (!parent) return false;
    const p = parent.toLowerCase();
    const c = child.toLowerCase();
    if (p === c) return true;
    const pWithSep = p.endsWith(path.sep) ? p : p + path.sep;
    return c.startsWith(pWithSep);
}

function init(config) {
    if (config['@CORE']) roots['@CORE'] = normalizeRoot(config['@CORE']);
    if (config['@LIBRARY']) roots['@LIBRARY'] = normalizeRoot(config['@LIBRARY']);
    if (config['@TOOLS']) roots['@TOOLS'] = normalizeRoot(config['@TOOLS']);
    if (config['@WORKSPACE']) roots['@WORKSPACE'] = normalizeRoot(config['@WORKSPACE']);
    if (config['@ROOT']) roots['@ROOT'] = normalizeRoot(config['@ROOT']);
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
        const normRequested = path.normalize(requestedPath);
        let foundPrefix = null;
        for (const [pref, root] of Object.entries(roots)) {
            if (!root) continue;
            if (isWithin(root, normRequested)) {
                foundPrefix = pref;
                break;
            }
        }
        if (!foundPrefix) {
            throw new Error(`SecurityError: Access denied. Absolute path "${requestedPath}" is outside all authorized roots.`);
        }
        // If found, treat it as validated since it belongs to a root
        return normRequested;
    }

    const mappedRoot = roots[prefix];
    if (!mappedRoot) {
        throw new Error(`SecurityError: ${prefix ? 'Unknown or unauthorized prefix: ' + prefix : 'No path prefix provided (@ROOT, @WORKSPACE, etc.) and path is not absolute.'}`);
    }

    // Security: Prevent cleanPath from starting with slashes to avoid drive root resolution on Windows
    const finalCleanPath = cleanPath.replace(/^[\\\/]+/, '');
    
    // Resolve and Normalize
    const resolvedPath = path.resolve(mappedRoot, finalCleanPath);

    // Final "Zero Leak" Check: Every single path MUST start with its prefix root
    if (!isWithin(mappedRoot, resolvedPath)) {
        throw new Error(`SecurityError: Access denied. Path "${resolvedPath}" is outside its authorized root "${mappedRoot}".`);
    }

    return resolvedPath;
}

module.exports = {
    init,
    resolvePath,
    roots
};
